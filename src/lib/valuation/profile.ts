/**
 * VIN 档案 → 报价用车辆档案（纯函数）
 *
 * 只搬运渠道返回的事实：
 * - 渠道没给整备质量就保持 null，不做同平台推定。
 * - 展示用车类型只用于文案，定价分类在 pricing.ts 里按 vehicleClass 判断。
 */

import { vehicleTypeLabel } from "@/lib/vin/normalize";
import type { VinVehicleSpec } from "@/lib/vin/types";
import type { VehicleProfile } from "@/lib/valuation/pricing";

export function buildProfileFromSpec(spec: VinVehicleSpec, vin: string): VehicleProfile {
  const brandText = spec.brand ?? spec.manufacturer ?? "";
  const modelText = spec.modelName ?? spec.seriesName ?? "";
  const brandModel =
    modelText && brandText && modelText.startsWith(brandText)
      ? modelText
      : [brandText, modelText].filter(Boolean).join(" ") || "未知车型";

  const weightKg =
    spec.curbWeightKg !== null && Number.isFinite(spec.curbWeightKg) && spec.curbWeightKg > 0
      ? spec.curbWeightKg
      : null;

  return {
    vin,
    brandModel,
    vehicleType: vehicleTypeLabel(spec.vehicleClass, {
      isCommercial: spec.isCommercial,
      weightKg,
      seats: spec.seats,
    }),
    vehicleClass: spec.vehicleClass,
    seats: spec.seats,
    isCommercial: spec.isCommercial,
    weightKg,
    weightSource: weightKg === null ? "missing" : "vin",
    energyType: spec.energyType,
    fuelType: spec.fuelType,
    displacementMl: spec.displacementMl,
    modelYear: spec.modelYear ?? spec.vinYear,
    emission: spec.emissionStandard,
  };
}
