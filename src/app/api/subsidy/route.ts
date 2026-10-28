import { fail, ok, readJson, requireString } from "@/lib/api";
import type { RegionValue } from "@/lib/types";
import {
  getSubsidyView,
  PURCHASE_STAGES,
  saveSubsidy,
  type PurchaseStage,
} from "@/lib/services/subsidy";

export async function GET(request: Request) {
  const caseId = new URL(request.url).searchParams.get("caseId");
  if (!caseId) return fail(new Error("缺少 caseId"), 400);
  try {
    return ok(await getSubsidyView(caseId));
  } catch (err) {
    return fail(err, 400);
  }
}

export async function POST(request: Request) {
  const body = await readJson(request);
  try {
    const caseId = requireString(body, "caseId");
    const purchaseStage = requireString(body, "purchaseStage") as PurchaseStage;
    if (!PURCHASE_STAGES.some((s) => s.id === purchaseStage)) {
      throw new Error("请选择新车购买阶段");
    }
    await saveSubsidy(caseId, {
      purchaseStage,
      plannedPurchaseRegion:
        body.plannedPurchaseRegion && typeof body.plannedPurchaseRegion === "object"
          ? (body.plannedPurchaseRegion as RegionValue)
          : null,
      invoiceRegion:
        body.invoiceRegion && typeof body.invoiceRegion === "object"
          ? (body.invoiceRegion as RegionValue)
          : null,
      newRegistrationProvince:
        typeof body.newRegistrationProvince === "string"
          ? body.newRegistrationProvince
          : null,
      materials: Array.isArray(body.materials)
        ? body.materials.filter((m): m is string => typeof m === "string")
        : [],
    });
    return ok({ saved: true });
  } catch (err) {
    return fail(err, 400);
  }
}