import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCase, confirmFields, getCaseSnapshot, updateField } from "@/lib/services/cases";
import { selectQuote } from "@/lib/services/quotes";
import { selectSample, confirmDocument } from "@/lib/services/documents";
import { confirmAppointment } from "@/lib/services/appointments";
import { injectDemoStage, recordPaymentNotice, confirmPayment, resetAllDemo } from "@/lib/services/demo";
import { attachEvidence, CrossCaseEvidenceError } from "@/lib/services/evidence";
import { markRegistrationMissing } from "@/lib/services/documents";
import { resolveTask } from "@/lib/services/plan";

const s1Fields = {
  vehicleLocation: { value: { province: "四川", city: "成都" }, source: "text", confidence: 0.9 },
  registrationLocation: { value: { province: "四川", city: "成都" }, source: "text", confidence: 0.9 },
  ownerRelation: { value: "self", source: "text", confidence: 0.9 },
  drivable: { value: false, source: "text", confidence: 0.9 },
  intent: { value: "scrap", source: "text", confidence: 0.9 },
  documentsStatus: { value: "complete", source: "text", confidence: 0.9 },
};

let caseId = "";
let caseNo = "";
let vehicleId = "";

beforeAll(async () => {
  const created = await createCase({ scenarioId: "S1", fields: s1Fields });
  caseId = created.caseId;
  caseNo = created.caseNo;
  const snapshot = await getCaseSnapshot(caseId);
  vehicleId = snapshot!.vehicle.id;
});

afterAll(async () => {
  await resetAllDemo();
});

describe("服务层验收（A07 A09 A11 A12 A13 A14 A15）", () => {
  it("创建案件后两家报价净额为 1000 / 1050 元（整数分）", async () => {
    const snapshot = await getCaseSnapshot(caseId);
    const a = snapshot!.quotes.find((q) => q.providerId === "DEMO_PROVIDER_A");
    const b = snapshot!.quotes.find((q) => q.providerId === "DEMO_PROVIDER_B");
    expect(a?.netFen).toBe(100000);
    expect(b?.netFen).toBe(105000);
    expect(caseNo).toMatch(/^SC-DEMO-/);
  });

  it("A09：重复点击确认只生成一张预约", async () => {
    await confirmFields(caseId);
    await selectQuote(caseId, "DEMO_PROVIDER_B");
    await selectSample(caseId, "DRIVING_LICENSE", "DOC_CLEAR");
    await selectSample(caseId, "REGISTRATION_CERT", "DOC_CLEAR");
    await confirmDocument(caseId, "DRIVING_LICENSE");
    await confirmDocument(caseId, "REGISTRATION_CERT");

    const key = "test-idem-001";
    const first = await confirmAppointment({
      caseId,
      idempotencyKey: key,
      slotId: "DEMO_SLOT_B",
      location: "成都·演示停车点",
      handoverPerson: "演示车主",
      drivable: false,
    });
    const second = await confirmAppointment({
      caseId,
      idempotencyKey: key,
      slotId: "DEMO_SLOT_B",
      location: "成都·演示停车点",
      handoverPerson: "演示车主",
      drivable: false,
    });
    expect(second.id).toBe(first.id);
    const snapshot = await getCaseSnapshot(caseId);
    expect(snapshot!.appointment?.status).toBe("booked");
  });

  it("A11：只注入交接与回收证明时注销仍待确认", async () => {
    await injectDemoStage(caseId, "D2");
    let snapshot = await getCaseSnapshot(caseId);
    expect(snapshot!.tracks.find((t) => t.key === "recovery")?.status).toBe(
      "handed_over",
    );
    expect(snapshot!.tracks.find((t) => t.key === "deregistration")?.status).not.toBe(
      "demo_verified",
    );

    await injectDemoStage(caseId, "D3");
    snapshot = await getCaseSnapshot(caseId);
    const recovery = snapshot!.evidence.find((e) => e.type === "RECOVERY_CERTIFICATE");
    expect(recovery?.status).toBe("provided");
    expect(snapshot!.tracks.find((t) => t.key === "deregistration")?.status).toBe(
      "awaiting_materials",
    );
  });

  it("A12：注销证明提供后只到待核验", async () => {
    await attachEvidence({
      caseId,
      vehicleId,
      type: "DEREGISTRATION_CERTIFICATE",
      status: "provided",
      description: "演示注销证明样例",
    });
    const snapshot = await getCaseSnapshot(caseId);
    expect(snapshot!.tracks.find((t) => t.key === "deregistration")?.status).toBe(
      "pending_check",
    );
    expect(snapshot!.tracks.find((t) => t.key === "deregistration")?.status).not.toBe(
      "demo_verified",
    );
  });

  it("A13：企业付款反馈仍等待用户确认到账", async () => {
    await recordPaymentNotice(caseId);
    let snapshot = await getCaseSnapshot(caseId);
    expect(snapshot!.tracks.find((t) => t.key === "settlement")?.status).toBe("notice");
    expect(snapshot!.tracks.find((t) => t.key === "settlement")?.status).not.toBe(
      "confirmed",
    );

    await confirmPayment(caseId);
    snapshot = await getCaseSnapshot(caseId);
    expect(snapshot!.tracks.find((t) => t.key === "settlement")?.status).toBe(
      "confirmed",
    );
  });

  it("A14：切换仅报废与换新不改变回收净额", async () => {
    const before = await getCaseSnapshot(caseId);
    const netBefore = before!.selectedQuote?.netFen;
    await updateField(caseId, "intent", "replace");
    let snapshot = await getCaseSnapshot(caseId);
    expect(snapshot!.case.intent).toBe("replace");
    expect(
      snapshot!.tasks.some((t) => t.kind === "subsidy_followup" && t.active),
    ).toBe(true);
    expect(snapshot!.selectedQuote?.netFen).toBe(netBefore);

    await updateField(caseId, "intent", "scrap");
    snapshot = await getCaseSnapshot(caseId);
    expect(
      snapshot!.tasks.some((t) => t.kind === "subsidy_followup" && t.active),
    ).toBe(false);
    expect(snapshot!.selectedQuote?.netFen).toBe(netBefore);
    expect(snapshot!.subsidy?.status).toBe("paused");
  });

  it("A15：跨案凭证被拒绝并给出原因", async () => {
    const other = await createCase({ scenarioId: "S1", fields: s1Fields });
    await expect(
      attachEvidence({
        caseId: other.caseId,
        vehicleId,
        type: "HANDOVER_RECEIPT",
        status: "provided",
      }),
    ).rejects.toBeInstanceOf(CrossCaseEvidenceError);
    await expect(
      attachEvidence({
        caseId: other.caseId,
        vehicleId,
        type: "HANDOVER_RECEIPT",
        status: "provided",
      }),
    ).rejects.toThrow(/跨案|另一案件/);
  });

  it("D5/D6：注销证明核验后才推进注销，仍不影响补贴", async () => {
    await injectDemoStage(caseId, "D5");
    let snapshot = await getCaseSnapshot(caseId);
    expect(snapshot!.tracks.find((t) => t.key === "deregistration")?.status).toBe(
      "pending_check",
    );
    await injectDemoStage(caseId, "D6");
    snapshot = await getCaseSnapshot(caseId);
    expect(snapshot!.tracks.find((t) => t.key === "deregistration")?.status).toBe(
      "demo_verified",
    );
    expect(snapshot!.subsidy?.status).toBe("paused");
  });

  it("A22：缺证解决说明在地区变化后失效并重建核对任务", async () => {
    const created = await createCase({
      scenarioId: "S2",
      fields: { ...s1Fields, documentsStatus: { value: "missing_registration", source: "text", confidence: 0.9 } },
    });
    await markRegistrationMissing(created.caseId);
    let snapshot = await getCaseSnapshot(created.caseId);
    let task = snapshot!.tasks.find((t) => t.kind === "review_missing_document");
    expect(task?.active).toBe(true);

    await resolveTask(
      created.caseId,
      "review_missing_document",
      "演示核对：拟办理地接受情况说明，仍需以受理渠道为准。",
    );
    snapshot = await getCaseSnapshot(created.caseId);
    task = snapshot!.tasks.find((t) => t.kind === "review_missing_document");
    expect(task?.status).toBe("resolved");

    await updateField(created.caseId, "registrationLocation", {
      province: "四川",
      city: "绵阳",
    });
    snapshot = await getCaseSnapshot(created.caseId);
    task = snapshot!.tasks.find((t) => t.kind === "review_missing_document");
    expect(task?.active).toBe(true);
    expect(task?.status).toBe("needs_reconfirmation");
  });

  it("A16：重置后案件与跨案数据清空，回到同一 seed", async () => {
    await resetAllDemo();
    expect(await getCaseSnapshot(caseId)).toBeNull();
  });
});