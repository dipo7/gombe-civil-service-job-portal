import { describe, expect, it } from "vitest";
import { calculateAge, parseIsoDate } from "@/lib/age";
import { canonicalEmail, generateReference, normalizePhone } from "@/lib/normalize";
import { degreeRank } from "@/lib/constants";
import {
  applicationFieldsSchema,
  hasValidDocumentSignature,
  hasValidSignature,
  resolveCourse,
  safeDisplayFileName,
} from "@/lib/validation";
import { readJobForm } from "@/lib/admin-validation";

describe("age", () => {
  it("parses only real calendar dates", () => {
    expect(parseIsoDate("1995-02-28")).not.toBeNull();
    expect(parseIsoDate("1995-02-30")).toBeNull();
    expect(parseIsoDate("95-02-28")).toBeNull();
    expect(parseIsoDate("2024-02-29")).not.toBeNull();
    expect(parseIsoDate("2023-02-29")).toBeNull();
  });

  it("counts full years, handling birthdays and leap days", () => {
    const ref = new Date("2026-06-15T00:00:00Z");
    expect(calculateAge(new Date("2000-06-15T00:00:00Z"), ref)).toBe(26);
    expect(calculateAge(new Date("2000-06-16T00:00:00Z"), ref)).toBe(25);
    expect(calculateAge(new Date("2000-02-29T00:00:00Z"), new Date("2026-02-28T00:00:00Z"))).toBe(25);
  });
});

describe("dedupe normalisation", () => {
  it("collapses gmail dots, plus tags and googlemail", () => {
    const keys = ["John.Doe@gmail.com", "johndoe+jobs@gmail.com", "j.o.h.n.d.o.e@googlemail.com"].map(canonicalEmail);
    expect(new Set(keys)).toEqual(new Set(["johndoe@gmail.com"]));
  });

  it("keeps dots for other providers but strips plus tags", () => {
    expect(canonicalEmail("a.b+x@example.com")).toBe("a.b@example.com");
  });

  it("normalises Nigerian phone formats to one value", () => {
    expect(normalizePhone("08012345678")).toBe("+2348012345678");
    expect(normalizePhone("+234 801 234 5678")).toBe("+2348012345678");
    expect(normalizePhone("0801-234-5678")).toBe("+2348012345678");
  });

  it("generates well-formed, non-ambiguous references", () => {
    for (let i = 0; i < 50; i++) expect(generateReference()).toMatch(/^GSC-[A-HJ-NP-Z2-9]{8}$/);
    expect(new Set(Array.from({ length: 200 }, generateReference)).size).toBe(200);
  });
});

describe("degree ranking", () => {
  it("orders classes best to worst within a type", () => {
    expect(degreeRank("UNIVERSITY", "FIRST_CLASS")).toBeLessThan(degreeRank("UNIVERSITY", "SECOND_CLASS_UPPER"));
    expect(degreeRank("POLYTECHNIC", "DISTINCTION")).toBeLessThan(degreeRank("POLYTECHNIC", "PASS"));
  });

  it("returns -1 for a class that does not belong to the type", () => {
    expect(degreeRank("UNIVERSITY", "DISTINCTION")).toBe(-1);
    expect(degreeRank("POLYTECHNIC", "FIRST_CLASS")).toBe(-1);
  });
});

describe("applicationFieldsSchema", () => {
  const valid = {
    fullName: "Aisha Bello",
    email: "Aisha@Example.com",
    phone: "08012345678",
    stateOfOrigin: "Gombe",
    lga: "Akko",
    dateOfBirth: "1995-03-10",
    degreeType: "UNIVERSITY",
    degreeClass: "SECOND_CLASS_UPPER",
    course: "Physics",
    courseOther: "",
    institution: "  Gombe   State University ",
    graduationYear: "2018",
    declaration: true,
    consent: true,
  };

  it("accepts a valid application and normalises text", () => {
    const r = applicationFieldsSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBe("aisha@example.com");
      expect(r.data.institution).toBe("Gombe State University");
      expect(r.data.graduationYear).toBe(2018);
    }
  });

  const issuePaths = (input: object) => {
    const r = applicationFieldsSchema.safeParse(input);
    return r.success ? [] : r.error.issues.map((i) => String(i.path[0]));
  };

  it("rejects a degree class that does not belong to the degree type", () => {
    expect(issuePaths({ ...valid, degreeClass: "DISTINCTION" })).toContain("degreeClass");
  });

  it("requires an LGA only for Gombe and forbids it elsewhere", () => {
    expect(issuePaths({ ...valid, lga: "" })).toContain("lga");
    expect(issuePaths({ ...valid, stateOfOrigin: "Kano", lga: "Akko" })).toContain("lga");
    expect(issuePaths({ ...valid, stateOfOrigin: "Kano", lga: "" })).not.toContain("lga");
  });

  it("requires a typed course only when Other is chosen", () => {
    expect(issuePaths({ ...valid, course: "Other", courseOther: "" })).toContain("courseOther");
    expect(issuePaths({ ...valid, course: "Other", courseOther: "Peace Studies" })).not.toContain("courseOther");
    expect(issuePaths({ ...valid, course: "Not A Course" })).toContain("course");
    expect(resolveCourse({ course: "Other", courseOther: "  Peace   Studies " })).toBe("Peace Studies");
    expect(resolveCourse({ course: "Physics", courseOther: "ignored" })).toBe("Physics");
  });

  it("rejects bad phone numbers, impossible dates and unrealistic ages", () => {
    expect(issuePaths({ ...valid, phone: "12345" })).toContain("phone");
    expect(issuePaths({ ...valid, dateOfBirth: "1995-02-30" })).toContain("dateOfBirth");
    expect(issuePaths({ ...valid, dateOfBirth: "2020-01-01" })).toContain("dateOfBirth");
  });

  it("rejects a future graduation year", () => {
    expect(issuePaths({ ...valid, graduationYear: String(new Date().getFullYear() + 1) })).toContain("graduationYear");
  });

  it("requires the declaration and privacy consent", () => {
    expect(issuePaths({ ...valid, declaration: false })).toContain("declaration");
    expect(issuePaths({ ...valid, consent: false })).toContain("consent");
  });
});

describe("file signatures", () => {
  it("recognises PDF and DOCX (zip) content, not just extensions", () => {
    expect(hasValidSignature(Buffer.from("%PDF-1.7 ..."), "pdf")).toBe(true);
    expect(hasValidSignature(Buffer.from("MZ executable"), "pdf")).toBe(false);
    expect(hasValidSignature(Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0]), "docx")).toBe(true);
    expect(hasValidSignature(Buffer.from("plain text"), "docx")).toBe(false);
  });

  it("recognises PDF, JPEG and PNG documents and rejects mismatches", () => {
    expect(hasValidDocumentSignature(Buffer.from("%PDF-1.4"), "application/pdf")).toBe(true);
    expect(hasValidDocumentSignature(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg")).toBe(true);
    expect(hasValidDocumentSignature(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png")).toBe(true);
    expect(hasValidDocumentSignature(Uint8Array.from([0xff, 0xd8, 0xff]), "image/png")).toBe(false);
    expect(hasValidDocumentSignature(Buffer.from("%PDF-1.4"), "image/gif")).toBe(false);
  });

  it("sanitises display file names", () => {
    expect(safeDisplayFileName("../../etc/passwd")).toBe("passwd");
    expect(safeDisplayFileName('my "cv"<1>.pdf')).toBe("my _cv__1_.pdf");
    expect(safeDisplayFileName("")).toBe("resume");
  });
});

describe("admin job form", () => {
  const base = () => {
    const fd = new FormData();
    const fields: Record<string, string> = {
      title: "Clerk",
      department: "Finance",
      location: "Gombe",
      description: "A long enough description here.",
      responsibilities: "a\nb",
      requirements: "",
      hrEmail: "HR@x.gov.ng",
      closesAt: "",
      minAge: "18",
      maxAge: "35",
      isOpen: "on",
      minClass_UNIVERSITY: "SECOND_CLASS_LOWER",
      minClass_POLYTECHNIC: "PASS",
      minClass_NCE: "PASS",
    };
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return fd;
  };

  it("parses a valid job and builds degree rules only for ticked types", () => {
    const fd = base();
    fd.set("accept_UNIVERSITY", "on");
    const r = readJobForm(fd);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.degreeRules).toEqual([{ type: "UNIVERSITY", minClass: "SECOND_CLASS_LOWER" }]);
      expect(r.data.hrEmail).toBe("hr@x.gov.ng");
    }
  });

  it("rejects min age above max age and LGA limits without the indigene flag", () => {
    const fd = base();
    fd.set("minAge", "40");
    fd.append("allowedLgas", "Akko");
    const r = readJobForm(fd);
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path[0]);
      expect(paths).toContain("maxAge");
      expect(paths).toContain("allowedLgas");
    }
  });
});
