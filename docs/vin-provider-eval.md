# 第三方 VIN 信息库接入评估

> 评估日期：2026-11-01 · 适用：报废残值评估（VIN / 行驶证 → 车型与残值）
> 结论先行：国内 VIN 解码没有稳定、免费、不限量的正式 API；有免费试用额度，足够跑通样例和小流量内测。

## 1. 实测结果

| 渠道 | 是否免费 | 实测结果 |
|---|---|---|
| NHTSA vPIC（美国官方） | 免费、无需 Key | 美国 VIN `1HGCM82633A004352` 可完整解出 Honda Accord / 2003 / 3.0L；中国 WMI（LSV、LFV、LZW、LGD、LHG）查询均为 0 条，不能用于国产车 |
| 极速数据 VIN 查询 | 免费 100 次，之后付费 | 接口 `https://api.jisuapi.com/vin/query`，返回品牌、车系、车型、年款、排量、排放标准、整备质量、燃油类型，字段最贴合残值测算；无 Key 返回 101 |
| 聚合数据 VIN 精准版（ID 862） | 需申请试用 | 直连工信部公告数据，返回品牌/车系/车型/排量/排放/尺寸/变速箱/整备质量；需实名认证与应用场景审核，价格需申请后确认 |
| 17vin | 未看到免费额度 | VIN 解析 118 元/200 次（约 0.59 元/次），2500 次 688 元（约 0.275 元/次）；偏汽配场景 |
| 车300 云市场 | 需商务 | 二手车估值 0.1 元/次；VIN/行驶证 OCR 能力在售，需商务询价；优势是车型库与估值数据一体 |
| 腾讯云 OCR | 每月 1000 次免费 | 行驶证识别 120 元/1000 次（0.12 元/次），VIN 码识别同价；免费额度每月 1 号发放，适合拍照识别路径 |
| 51macc 网站接口 | 无需登录 | `getVinType` 可返回厂商（LSV→上汽大众、LZW→上汽通用五菱、LGD→郑州日产），但只到厂商级，且是站点内部接口，无开放协议/SLA，不建议生产依赖 |

## 2. 成本测算

按「VIN 解码一次」计费：

- 每天 100 次（约 3000 次/月）：极速数据买 1 万次包 450 元，可用约 3 个月，折合约 **0.045 元/次、135 元/月**。
- 每天 1000 次（约 3 万次/月）：极速数据 3 个 1 万次包，约 **1350 元/月**。
- 同等流量走 17vin 2500 次包：约 **8250 元/月**，成本高一个量级。
- 行驶证 OCR 每天 1000 次（3 万次/月）：腾讯云 1000 次免费 + 2.9 万次付费，约 **3480 元/月**；每天 30 次以内可完全落在免费额度里。

内测阶段（100 次 VIN + 每月 1000 次 OCR）成本为 **0 元**。

## 3. 推荐方案

### 阶段一：现在到内测（0 元）

1. VIN 解码接极速数据，用申请赠送的 100 次做真实车型验证；保留现有本地 WMI/年款规则作为兜底。
2. 行驶证拍照接腾讯云 OCR，每月 1000 次免费额度；识别出 VIN 后再走 VIN 解码，两个能力可以串起来。
3. 所有第三方调用放在服务端，设置 1.5 秒超时；失败时回退本地规则并在报告里把「评估把握度」降一档。

### 阶段二：正式上线（按量付费）

- 如果车型准确率要求高（尤其是新能源、进口车、公告型号），优先谈聚合数据 862 或车300；前者字段全、后者可同时买估值。
- 极速数据作为性价比主通道，0.045 元/次，适合大部分国产燃油车。
- 精友适合保险/事故车深度数据，报价制，现阶段不必上。

## 4. 接入设计（2026-11-01 已实现）

```ts
// 实际落地：src/lib/vin/
export type VinVehicleSpec = {
  vin: string;
  brand: string | null;
  seriesName: string | null;
  modelName: string | null;
  modelYear: number | null;
  displacementMl: number | null;
  emissionStandard: string | null;
  curbWeightKg: number | null;
  fuelType: string | null;
  energyType: "gasoline" | "diesel" | "hybrid" | "electric" | "other";
  newCarPriceFen: number | null;
  vehicleClass: VehicleClass;
  // …其余字段见 src/lib/vin/types.ts
};

export interface VinProvider {
  id: string;
  label: string;
  costFenPerQuery: number | null;
  isConfigured(): boolean;
  query(vin: string, context: VinQueryContext): Promise<VinProviderResult>;
}
```

- `JISUEPC_APPKEY` 放 `.env.local` / 容器环境变量，只在服务端读取，不暴露给浏览器。
- 缓存：`baofei:vin:v1:spec:<provider>:<vin>`，TTL 30 天；无结果另做 10 分钟负缓存。
- 兜底顺序：缓存 → 渠道按 `VIN_PROVIDER_ORDER` 依次尝试 → 本地 WMI/年款 → 标记「推定」。
- 报告字段：渠道有值就用，缺字段沿用现有推定逻辑，并在 `estimatedFields` 里列出。
- 监控：`vin_lookups` 表记录 provider、耗时、命中/失败与成本，不记录 VIN 明文以外的用户信息。
- 多渠道扩展说明见 `docs/vin-providers.md`。

## 5. 风险与注意事项

- **准确率**：VIN 只保证唯一性，不保证第三方库覆盖所有年款；冷门车/改装车可能返回多候选，需要人工确认。
- **合规**：VIN 属于车辆标识，不等同个人信息；但拍照可能带入车主姓名、住址，上传前应做裁剪或提示，服务端不保存原图。
- **稳定性**：免费额度通常限流；生产要配置重试、超时、缓存和降级，不能让第三方故障阻断报告。
- **价格**：以上为 2026-11-01 页面公开价，商务价和免费额度可能调整，签约前复核。
- **非正式接口**：51macc 这类站点内部接口不要用于生产，随时可能变更或封禁。

## 6. 需要确认的事项

1. 是否先用极速数据免费 100 次跑真实 VIN 验证？需要注册后提供 `appkey`。
2. 行驶证 OCR 是否走腾讯云？需要 `SecretId` / `SecretKey`，或先在控制台开通后由我接。
3. 正式上线预期日调用量，用来决定买 1 万次包还是直接谈聚合/车300 商务价。