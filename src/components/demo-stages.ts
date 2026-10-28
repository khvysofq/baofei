export const DEMO_STAGES_LABEL = [
  { id: "D1", label: "D1 已预约", description: "预约回执；不推进交接、注销或收款。" },
  { id: "D2", label: "D2 已交接", description: "企业交接记录；不推进注销或补贴。" },
  { id: "D3", label: "D3 回收证明已提供", description: "待核验；不推进注销或到账。" },
  { id: "D4", label: "D4 回收证明核验", description: "仅核验回收证明。" },
  { id: "D5", label: "D5 注销证明已提供", description: "待核验；不完成注销。" },
  { id: "D6", label: "D6 注销核验完成", description: "仅推进注销；到账仍需确认。" },
  { id: "D7", label: "D7 到账已确认", description: "确认到账；不推进补贴。" },
] as const;