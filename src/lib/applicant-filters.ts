import type { Prisma } from "@prisma/client";

export type ApplicantFilter = { key: string; label: string; where: Prisma.ApplicationWhereInput };

export const APPLICANT_FILTERS: ApplicantFilter[] = [
  { key: "all", label: "All", where: {} },
  { key: "in", label: "Screened in", where: { status: "Screened_In" } },
  { key: "out", label: "Screened out (review queue)", where: { status: "Screened_Out" } },
  { key: "shortlisted", label: "Shortlisted", where: { hrDecision: "Shortlisted" } },
  { key: "rejected", label: "Rejected", where: { hrDecision: "Rejected" } },
  { key: "failed", label: "Email failed", where: { dispatchStatus: "Failed" } },
];

export function resolveFilter(key: string | undefined): ApplicantFilter {
  return APPLICANT_FILTERS.find((f) => f.key === key) ?? APPLICANT_FILTERS[0]!;
}
