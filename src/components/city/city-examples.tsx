import { connection } from "next/server";
import { formatYuan } from "@/lib/domain/money";
import {
  computeQuote,
  type VehicleProfile,
} from "@/lib/valuation/pricing";
import { getActivePricing } from "@/lib/valuation/pricing-store";
import { REGION_TOW_KM, type City } from "@/lib/seo/cities";

/**
 * 常见车型的参考区间。
 *
 * 数字由真实定价引擎在请求时算出，不写死，所以后台改价后不用改代码；
 * 用 connection() 让这一段走动态渲染，避免构建期把内置默认价目表烤进静态页。
 */
const SAMPLES: {
  label: string;
  note: string;
  weightKg: number;
  vehicleClass: VehicleProfile["vehicleClass"];
  seats: number;
}[] = [
  { label: "小型轿车", note: "1.6L 手动/自动", weightKg: 1250, vehicleClass: "sedan", seats: 5 },
  { label: "紧凑型 SUV", note: "1.5T 两驱", weightKg: 1580, vehicleClass: "suv", seats: 5 },
  { label: "微面", note: "五菱之光一类", weightKg: 1000, vehicleClass: "van", seats: 7 },
  { label: "轻型货车", note: "4.2 米厢货", weightKg: 2500, vehicleClass: "truck", seats: 3 },
];

function profile(weightKg: number, vehicleClass: VehicleProfile["vehicleClass"], seats: number): VehicleProfile {
  return {
    vin: "LSVAL41Z882104202",
    brandModel: "示例车型",
    vehicleType: "示例车型",
    vehicleClass,
    seats,
    isCommercial: false,
    weightKg,
    weightSource: "vin",
    energyType: "gasoline",
    fuelType: "汽油",
    displacementMl: 1600,
    modelYear: 2012,
    emission: "国 IV",
  };
}

export async function CityExamples({ city }: { city: City }) {
  await connection();
  const active = await getActivePricing();
  const distanceKm = REGION_TOW_KM[city.region];

  const rows = SAMPLES.map((sample) => {
    const quote = computeQuote({
      vehicle: profile(sample.weightKg, sample.vehicleClass, sample.seats),
      pricing: active.config,
      options: {
        wheelType: "alloy",
        towMode: "pickup",
        distanceKm,
        missingParts: {},
        partsConfirmed: true,
      },
    });
    const towFen = quote.deductionLines
      .filter((line) => line.kind === "tow")
      .reduce((sum, line) => sum + line.amountFen, 0);
    const serviceFen = quote.deductionLines
      .filter((line) => line.kind === "service")
      .reduce((sum, line) => sum + line.amountFen, 0);

    return {
      label: sample.label,
      note: sample.note,
      weightKg: sample.weightKg,
      vehicleFen: quote.vehicleSubtotalFen,
      towFen,
      serviceFen,
      range: quote.range,
    };
  });

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-line bg-panel">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <caption className="sr-only">
            {city.name}常见车型报废参考区间，按 {distanceKm} 公里拖运估算
          </caption>
          <thead>
            <tr className="border-b border-line text-left text-xs text-dim">
              <th scope="col" className="px-3 py-2.5 font-semibold">车型</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">整备质量</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">车值</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">拖运 / 服务费</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">预计到手区间</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-line/70 last:border-0">
                <th scope="row" className="px-3 py-3 text-left font-semibold">
                  {row.label}
                  <span className="mono ml-1.5 block text-[10px] font-normal text-dim">
                    {row.note}
                  </span>
                </th>
                <td className="mono px-3 py-3 text-right tabular text-dim">
                  {row.weightKg} kg
                </td>
                <td className="mono px-3 py-3 text-right tabular">
                  ¥{formatYuan(row.vehicleFen)}
                </td>
                <td className="mono px-3 py-3 text-right tabular text-dim">
                  {row.towFen === 0 && row.serviceFen === 0
                    ? "免拖运"
                    : [
                        row.towFen > 0 ? `-¥${formatYuan(row.towFen)}` : null,
                        row.serviceFen > 0 ? `/ ¥${formatYuan(row.serviceFen)}` : null,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                </td>
                <td className="mono px-3 py-3 text-right tabular font-bold text-brand">
                  {row.range
                    ? `¥${formatYuan(row.range.lowFen)} ~ ¥${formatYuan(row.range.highFen)}`
                    : "待现场称重"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-dim">
        按 {city.region}片区典型拖运里程 {distanceKm} 公里、铝圈齐全无缺件估算；
        价目表版本 {active.config.rateCardVersion}
        {active.fallback ? "（当前为内置默认价目表，后台尚未发布配置）" : ""}。
        拖运按实际里程计费，缺件另扣，最终以验车与地磅称重为准。
      </p>
    </div>
  );
}