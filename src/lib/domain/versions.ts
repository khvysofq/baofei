import type {
  AppointmentRecord,
  CaseRecord,
  FieldName,
  ResolutionVersions,
} from "@/lib/types";

/** 影响报价/预约摘要的字段；修改后必须重新确认。 */
export const PROFILE_AFFECTING_FIELDS: ReadonlySet<FieldName> = new Set<FieldName>([
  "vehicleLocation",
  "registrationLocation",
  "drivable",
  "ownerRelation",
]);

/** 只影响补贴待办，不得触碰材料、报价或凭证。 */
export const SUBSIDY_ONLY_FIELDS: ReadonlySet<FieldName> = new Set<FieldName>([
  "intent",
  "specialCase",
]);

export function nextVersion(version: number): number {
  return Number.isInteger(version) && version >= 1 ? version + 1 : 1;
}

export function isQuoteStale(
  selectedVersion: number | null,
  activeVersion: number | null,
): boolean {
  if (selectedVersion === null || activeVersion === null) return true;
  return selectedVersion < activeVersion;
}

export function appointmentNeedsReconfirmation(
  appointment: Pick<
    AppointmentRecord,
    "status" | "quoteVersion" | "profileVersion" | "materialsVersion"
  > | null,
  versions: {
    activeQuoteVersion: number;
    profileVersion: number;
    materialsVersion: number;
  },
): boolean {
  if (!appointment) return false;
  if (appointment.status === "cancelled") return false;
  if (appointment.status === "needs_reconfirmation") return true;
  return (
    appointment.quoteVersion < versions.activeQuoteVersion ||
    appointment.profileVersion !== versions.profileVersion ||
    appointment.materialsVersion !== versions.materialsVersion
  );
}

export function buildResolutionVersions(
  profileVersion: number,
  materialsVersion: number,
  vehicleCity: string | null,
  registrationCity: string | null,
): ResolutionVersions {
  return { profileVersion, materialsVersion, vehicleCity, registrationCity };
}

/**
 * 缺证解决说明只在创建时的版本与地区仍有效时成立。
 * 事实或地区变化后必须失效并重建核对任务。
 */
export function missingDocResolutionValid(
  resolution: ResolutionVersions | null | undefined,
  current: {
    profileVersion: number;
    materialsVersion: number;
    vehicleCity: string | null;
    registrationCity: string | null;
  },
): boolean {
  if (!resolution) return false;
  return (
    resolution.profileVersion === current.profileVersion &&
    resolution.materialsVersion === current.materialsVersion &&
    resolution.vehicleCity === current.vehicleCity &&
    resolution.registrationCity === current.registrationCity
  );
}

export function touchedProfile(
  field: FieldName,
  oldValue: unknown,
  newValue: unknown,
): boolean {
  if (!PROFILE_AFFECTING_FIELDS.has(field)) return false;
  return JSON.stringify(oldValue) !== JSON.stringify(newValue);
}

export function caseVersions(c: Pick<CaseRecord, "profileVersion" | "materialsVersion">) {
  return { profileVersion: c.profileVersion, materialsVersion: c.materialsVersion };
}