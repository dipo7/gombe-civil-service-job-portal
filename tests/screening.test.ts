import { describe, expect, it } from "vitest";
import { screenCandidate, type Candidate, type JobRules } from "@/lib/screening";

const NOW = new Date("2026-06-15T12:00:00Z");

const openRules: JobRules = { minAge: null, maxAge: null, requireGombeOrigin: false, allowedLgas: [], degreeRules: [] };

const candidate = (over: Partial<Candidate> = {}): Candidate => ({
  dateOfBirth: new Date("1995-01-01T00:00:00Z"),
  stateOfOrigin: "Gombe",
  lga: "Akko",
  degreeType: "UNIVERSITY",
  degreeClass: "SECOND_CLASS_UPPER",
  ...over,
});

const rules = (over: Partial<JobRules> = {}): JobRules => ({ ...openRules, ...over });

const reasons = (r: ReturnType<typeof screenCandidate>) => (r.passed ? [] : r.reasons);

describe("screenCandidate: no rules", () => {
  it("passes anyone when the job sets no criteria", () => {
    expect(screenCandidate(candidate({ stateOfOrigin: "Lagos", lga: null, degreeClass: "PASS" }), openRules, NOW)).toEqual({ passed: true });
  });
});

describe("screenCandidate: age", () => {
  const r = rules({ minAge: 21, maxAge: 35 });

  it("accepts someone exactly on the minimum age", () => {
    // Turns 21 on 2026-06-15
    expect(screenCandidate(candidate({ dateOfBirth: new Date("2005-06-15T00:00:00Z") }), r, NOW).passed).toBe(true);
  });

  it("rejects someone one day short of the minimum age", () => {
    const out = screenCandidate(candidate({ dateOfBirth: new Date("2005-06-16T00:00:00Z") }), r, NOW);
    expect(reasons(out)).toEqual(["age 20 below minimum 21"]);
  });

  it("accepts someone the day before their 36th birthday and rejects them on it", () => {
    expect(screenCandidate(candidate({ dateOfBirth: new Date("1990-06-16T00:00:00Z") }), r, NOW).passed).toBe(true); // 35
    expect(reasons(screenCandidate(candidate({ dateOfBirth: new Date("1990-06-15T00:00:00Z") }), r, NOW))).toEqual(["age 36 above maximum 35"]);
  });

  it("rejects someone above the maximum age", () => {
    const out = screenCandidate(candidate({ dateOfBirth: new Date("1980-01-01T00:00:00Z") }), r, NOW);
    expect(reasons(out)).toEqual(["age 46 above maximum 35"]);
  });

  it("applies only the bound that is set", () => {
    expect(screenCandidate(candidate(), rules({ minAge: 30 }), NOW).passed).toBe(true); // 31
    expect(screenCandidate(candidate(), rules({ maxAge: 30 }), NOW).passed).toBe(false);
  });
});

describe("screenCandidate: degree rules", () => {
  const r = rules({
    degreeRules: [
      { type: "UNIVERSITY", minClass: "SECOND_CLASS_LOWER" },
      { type: "POLYTECHNIC", minClass: "UPPER_CREDIT" },
    ],
  });

  it("accepts a class equal to or better than the minimum", () => {
    expect(screenCandidate(candidate({ degreeClass: "SECOND_CLASS_LOWER" }), r, NOW).passed).toBe(true);
    expect(screenCandidate(candidate({ degreeClass: "FIRST_CLASS" }), r, NOW).passed).toBe(true);
  });

  it("rejects a class below the minimum", () => {
    expect(reasons(screenCandidate(candidate({ degreeClass: "THIRD_CLASS" }), r, NOW))).toEqual([
      "degree class THIRD_CLASS below minimum SECOND_CLASS_LOWER",
    ]);
    expect(screenCandidate(candidate({ degreeClass: "PASS" }), r, NOW).passed).toBe(false);
  });

  it("ranks polytechnic classes independently of university classes", () => {
    const poly = (degreeClass: Candidate["degreeClass"]) => candidate({ degreeType: "POLYTECHNIC", degreeClass });
    expect(screenCandidate(poly("DISTINCTION"), r, NOW).passed).toBe(true);
    expect(screenCandidate(poly("UPPER_CREDIT"), r, NOW).passed).toBe(true);
    expect(screenCandidate(poly("LOWER_CREDIT"), r, NOW).passed).toBe(false);
    expect(screenCandidate(poly("PASS"), r, NOW).passed).toBe(false);
  });

  it("rejects a degree type the job does not list", () => {
    expect(reasons(screenCandidate(candidate({ degreeType: "NCE", degreeClass: "DISTINCTION" }), r, NOW))).toEqual(["degree type NCE not accepted"]);
  });

  it("supports NCE-only jobs", () => {
    const nce = rules({ degreeRules: [{ type: "NCE", minClass: "CREDIT" }] });
    expect(screenCandidate(candidate({ degreeType: "NCE", degreeClass: "CREDIT" }), nce, NOW).passed).toBe(true);
    expect(screenCandidate(candidate({ degreeType: "NCE", degreeClass: "MERIT" }), nce, NOW).passed).toBe(false);
  });

  it("rejects a class that does not exist for the candidate's degree type", () => {
    const out = screenCandidate(candidate({ degreeType: "UNIVERSITY", degreeClass: "DISTINCTION" }), r, NOW);
    expect(out.passed).toBe(false);
  });
});

describe("screenCandidate: origin", () => {
  it("requires Gombe origin when the job demands it", () => {
    const r = rules({ requireGombeOrigin: true });
    expect(screenCandidate(candidate(), r, NOW).passed).toBe(true);
    expect(reasons(screenCandidate(candidate({ stateOfOrigin: "Kano", lga: null }), r, NOW))).toEqual(["state of origin Kano is not Gombe"]);
  });

  it("restricts to the listed LGAs", () => {
    const r = rules({ requireGombeOrigin: true, allowedLgas: ["Gombe", "Akko"] });
    expect(screenCandidate(candidate({ lga: "Akko" }), r, NOW).passed).toBe(true);
    expect(screenCandidate(candidate({ lga: "Billiri" }), r, NOW).passed).toBe(false);
  });

  it("rejects non-Gombe candidates on LGA-restricted jobs", () => {
    const r = rules({ allowedLgas: ["Gombe"] });
    expect(screenCandidate(candidate({ stateOfOrigin: "Bauchi", lga: null }), r, NOW).passed).toBe(false);
  });

  it("rejects a Gombe candidate with a missing LGA on LGA-restricted jobs", () => {
    expect(screenCandidate(candidate({ lga: null }), rules({ allowedLgas: ["Gombe"] }), NOW).passed).toBe(false);
  });
});

describe("screenCandidate: combined", () => {
  it("collects every failing reason, not just the first", () => {
    const r = rules({
      minAge: 20,
      maxAge: 30,
      requireGombeOrigin: true,
      degreeRules: [{ type: "POLYTECHNIC", minClass: "UPPER_CREDIT" }],
    });
    const out = screenCandidate(candidate({ dateOfBirth: new Date("1980-01-01T00:00:00Z"), stateOfOrigin: "Lagos", lga: null }), r, NOW);
    expect(reasons(out)).toEqual([
      "age 46 above maximum 30",
      "state of origin Lagos is not Gombe",
      "degree type UNIVERSITY not accepted",
    ]);
  });

  it("does not mutate its inputs", () => {
    const c = candidate();
    const r = rules({ minAge: 21, degreeRules: [{ type: "UNIVERSITY", minClass: "PASS" }] });
    const before = JSON.stringify([c, r]);
    screenCandidate(c, r, NOW);
    expect(JSON.stringify([c, r])).toBe(before);
  });
});
