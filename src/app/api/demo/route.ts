import { fail, ok, readJson, requireString } from "@/lib/api";
import {
  DEMO_STAGES,
  exportDemoRecord,
  injectDemoStage,
  recordPaymentNotice,
  resetAllDemo,
  type DemoStageId,
} from "@/lib/services/demo";

export async function POST(request: Request) {
  const body = await readJson(request);
  try {
    const action = requireString(body, "action");
    if (action === "reset") {
      await resetAllDemo();
      return ok({ reset: true });
    }
    const caseId = requireString(body, "caseId");
    if (action === "inject") {
      const stage = requireString(body, "stage") as DemoStageId;
      if (!DEMO_STAGES.some((s) => s.id === stage)) throw new Error("未知演示阶段");
      return ok(await injectDemoStage(caseId, stage));
    }
    if (action === "payment_notice") {
      await recordPaymentNotice(caseId);
      return ok({ notice: true });
    }
    if (action === "export") {
      return ok(await exportDemoRecord(caseId));
    }
    throw new Error("未知演示操作");
  } catch (err) {
    return fail(err, 400);
  }
}