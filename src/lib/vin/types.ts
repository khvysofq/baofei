/**
 * VIN 查询渠道抽象
 *
 * 目标：查询渠道可插拔。业务层只依赖 `VinProvider` 与 `VinVehicleSpec`，
 * 新增渠道 = 新增一个 provider 文件 + 注册，不改估值引擎与页面。
 */

export type VehicleClass =
  | "sedan"
  | "suv"
  | "mpv"
  | "van"
  | "pickup"
  | "truck"
  | "bus"
  | "other";

export type EnergyType = "gasoline" | "diesel" | "hybrid" | "electric" | "other";

/** 统一后的车辆档案。字段为 null 表示渠道没给，调用方必须按“未知”处理，不能当 0。 */
export type VinVehicleSpec = {
  vin: string;
  /** 品牌，如「斯柯达」 */
  brand: string | null;
  /** 厂家，如「上汽大众斯柯达」 */
  manufacturer: string | null;
  /** 完整车型名，如「明锐 2009款 1.6L 自动逸致版」 */
  modelName: string | null;
  /** 车系，如「明锐」 */
  seriesName: string | null;
  /** 年款（渠道给的车型年款，优先于 VIN 第 10 位） */
  modelYear: number | null;
  /** VIN 第 10 位解出的年份，仅作交叉校验 */
  vinYear: number | null;
  vehicleClass: VehicleClass;
  bodyType: string | null;
  sizeType: string | null;
  displacementMl: number | null;
  fuelType: string | null;
  energyType: EnergyType;
  /** 归一化后的排放标准，如「国 IV」 */
  emissionStandard: string | null;
  curbWeightKg: number | null;
  seats: number | null;
  gearbox: string | null;
  driveMode: string | null;
  /** 新车指导价/购置价，单位分 */
  newCarPriceFen: number | null;
  isCommercial: boolean | null;
  isImport: boolean | null;
  /** 渠道没提供的关键字段（中文名），用于报告里标注推定项 */
  missingFields: string[];
  providerId: string;
  providerLabel: string;
  fetchedAt: string;
  latencyMs: number;
  cached: boolean;
};

export type VinErrorCode =
  | "NOT_FOUND"
  | "INVALID_VIN"
  | "UNAUTHORIZED"
  | "QUOTA_EXCEEDED"
  | "IP_BLOCKED"
  | "RATE_LIMITED"
  | "MAINTENANCE"
  | "UPSTREAM_ERROR"
  | "TIMEOUT"
  | "NETWORK"
  | "BAD_RESPONSE"
  | "NOT_CONFIGURED";

export class VinQueryError extends Error {
  readonly code: VinErrorCode;
  readonly providerId: string;
  readonly providerLabel: string;
  /** 换下一个渠道是否有意义（格式错误 / 无结果外的渠道侧故障都值得换） */
  readonly retryable: boolean;
  readonly upstreamCode: string | null;
  readonly latencyMs: number;

  constructor(options: {
    code: VinErrorCode;
    message: string;
    providerId: string;
    providerLabel: string;
    retryable?: boolean;
    upstreamCode?: string | number | null;
    latencyMs?: number;
  }) {
    super(options.message);
    this.name = "VinQueryError";
    this.code = options.code;
    this.providerId = options.providerId;
    this.providerLabel = options.providerLabel;
    this.retryable = options.retryable ?? true;
    this.upstreamCode =
      options.upstreamCode === null || options.upstreamCode === undefined
        ? null
        : String(options.upstreamCode);
    this.latencyMs = options.latencyMs ?? 0;
  }
}

export type VinQueryContext = {
  signal: AbortSignal;
  timeoutMs: number;
};

export type VinProviderResult = {
  spec: Omit<VinVehicleSpec, "cached" | "providerId" | "providerLabel" | "latencyMs">;
  /** 原始返回，仅在 VIN_DEBUG_RAW=1 时落日志，不进报告。 */
  raw: unknown;
};

export interface VinProvider {
  readonly id: string;
  readonly label: string;
  /** 该渠道单次查询成本（分），用于成本统计；未知为 null。 */
  readonly costFenPerQuery: number | null;
  isConfigured(): boolean;
  query(vin: string, context: VinQueryContext): Promise<VinProviderResult>;
}

export type VinLookupOutcome = {
  spec: VinVehicleSpec;
  /** 实际给出数据的渠道 */
  providerId: string;
  cached: boolean;
  /** 本次尝试过的渠道与结果，便于排查与逐步切换 */
  attempts: VinAttempt[];
  fromCache: boolean;
};

export type VinAttempt = {
  providerId: string;
  providerLabel: string;
  ok: boolean;
  code: string | null;
  latencyMs: number;
  cached: boolean;
};