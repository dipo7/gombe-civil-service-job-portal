import { GOMBE_STATE, degreeRank, type DegreeClassValue, type DegreeTypeValue } from "./constants";
import { calculateAge } from "./age";

export type JobRules = {
  minAge: number | null;
  maxAge: number | null;
  requireGombeOrigin: boolean;
  allowedLgas: string[];
  degreeRules: { type: DegreeTypeValue; minClass: DegreeClassValue }[];
};

export type Candidate = {
  dateOfBirth: Date;
  stateOfOrigin: string;
  lga: string | null;
  degreeType: DegreeTypeValue;
  degreeClass: DegreeClassValue;
};

export type ScreeningOutcome = { passed: true } | { passed: false; reasons: string[] };

/**
 * Pure, deterministic hard-filter. Reasons are internal-only audit notes and
 * must never be returned to the applicant.
 */
export function screenCandidate(candidate: Candidate, rules: JobRules, now = new Date()): ScreeningOutcome {
  const reasons: string[] = [];

  const age = calculateAge(candidate.dateOfBirth, now);
  if (rules.minAge !== null && age < rules.minAge) reasons.push(`age ${age} below minimum ${rules.minAge}`);
  if (rules.maxAge !== null && age > rules.maxAge) reasons.push(`age ${age} above maximum ${rules.maxAge}`);

  if (rules.requireGombeOrigin && candidate.stateOfOrigin !== GOMBE_STATE) {
    reasons.push(`state of origin ${candidate.stateOfOrigin} is not ${GOMBE_STATE}`);
  }
  if (
    rules.allowedLgas.length > 0 &&
    (candidate.stateOfOrigin !== GOMBE_STATE || !candidate.lga || !rules.allowedLgas.includes(candidate.lga))
  ) {
    reasons.push(`LGA ${candidate.lga ?? "n/a"} not in allowed list`);
  }

  if (rules.degreeRules.length > 0) {
    const rule = rules.degreeRules.find((r) => r.type === candidate.degreeType);
    if (!rule) {
      reasons.push(`degree type ${candidate.degreeType} not accepted`);
    } else {
      const have = degreeRank(candidate.degreeType, candidate.degreeClass);
      const need = degreeRank(rule.type, rule.minClass);
      if (have === -1 || need === -1 || have > need) {
        reasons.push(`degree class ${candidate.degreeClass} below minimum ${rule.minClass}`);
      }
    }
  }

  return reasons.length === 0 ? { passed: true } : { passed: false, reasons };
}
