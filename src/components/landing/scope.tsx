import { SectionHeading } from "./section";

const CAN_DO = [
  "用一段日常描述开始，生成个人办理计划",
  "检查内置样例材料，标记缺项和字段不一致",
  "比较两家演示报价，逐项拆开费用并计算预计实收",
  "创建和取消模拟预约，生成本地演示记录",
  "按显式事件推进四条状态，查看凭证说明",
];

const CANNOT_DO = [
  "不联系真实回收企业，不查询真实资质",
  "不提供真实报价、拖车、支付或结算",
  "不提交补贴申请，不判定补贴资格",
  "不查询政府系统，不采集或上传真实证件",
  "不代替官方审核，演示结果不产生法律效力",
];

function ScopeList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "acid" | "danger";
}) {
  return (
    <div className="panel p-6 sm:p-8">
      <p
        className={`label flex items-center gap-2 ${
          tone === "acid" ? "text-acid" : "text-danger"
        }`}
      >
        <span className="lamp" aria-hidden />
        {title}
      </p>
      <ul className="mt-6 space-y-4">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-start gap-3 text-base leading-relaxed"
          >
            <span
              className={`mono mt-0.5 shrink-0 text-sm ${
                tone === "acid" ? "text-acid" : "text-danger"
              }`}
              aria-hidden
            >
              {tone === "acid" ? "+" : "−"}
            </span>
            <span className="text-dim">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ScopeSection() {
  return (
    <section
      id="scope"
      aria-labelledby="scope-title"
      className="scroll-mt-32 border-b border-line"
    >
      <div className="mx-auto max-w-[1440px] px-4 py-20 sm:px-6 lg:py-28">
        <SectionHeading
          index="04"
          eyebrow="边界"
          id="scope-title"
          title="这版做到哪里"
          intro="演示能完整走完一次办理，但不替你完成任何一项真实业务。下面两栏是明确的范围。"
        />
        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          <ScopeList title="这版能做" items={CAN_DO} tone="acid" />
          <ScopeList title="这版不做" items={CANNOT_DO} tone="danger" />
        </div>
      </div>
    </section>
  );
}