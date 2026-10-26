// Client-safe: no server-only imports. Values must stay in sync with prisma/schema.prisma enums.

export const DEGREE_TYPES = ["UNIVERSITY", "POLYTECHNIC", "NCE"] as const;
export type DegreeTypeValue = (typeof DEGREE_TYPES)[number];

export const DEGREE_TYPE_LABELS: Record<DegreeTypeValue, string> = {
  UNIVERSITY: "University (BSc/BA/B.Eng etc.)",
  POLYTECHNIC: "Polytechnic (HND/ND)",
  NCE: "NCE (College of Education)",
};

// Listed best -> worst. Index defines rank (lower index = better).
export const DEGREE_CLASSES_BY_TYPE = {
  UNIVERSITY: ["FIRST_CLASS", "SECOND_CLASS_UPPER", "SECOND_CLASS_LOWER", "THIRD_CLASS", "PASS"],
  POLYTECHNIC: ["DISTINCTION", "UPPER_CREDIT", "LOWER_CREDIT", "PASS"],
  NCE: ["DISTINCTION", "CREDIT", "MERIT", "PASS"],
} as const satisfies Record<DegreeTypeValue, readonly string[]>;

export const DEGREE_CLASS_VALUES = [
  "FIRST_CLASS",
  "SECOND_CLASS_UPPER",
  "SECOND_CLASS_LOWER",
  "THIRD_CLASS",
  "PASS",
  "DISTINCTION",
  "UPPER_CREDIT",
  "LOWER_CREDIT",
  "CREDIT",
  "MERIT",
] as const;
export type DegreeClassValue = (typeof DEGREE_CLASS_VALUES)[number];

export const DEGREE_CLASS_LABELS: Record<DegreeClassValue, string> = {
  FIRST_CLASS: "First Class",
  SECOND_CLASS_UPPER: "Second Class Upper",
  SECOND_CLASS_LOWER: "Second Class Lower",
  THIRD_CLASS: "Third Class",
  PASS: "Pass",
  DISTINCTION: "Distinction",
  UPPER_CREDIT: "Upper Credit",
  LOWER_CREDIT: "Lower Credit",
  CREDIT: "Credit",
  MERIT: "Merit",
};

export function classesForType(type: DegreeTypeValue): readonly DegreeClassValue[] {
  return DEGREE_CLASSES_BY_TYPE[type];
}

/** Lower number = better. Returns -1 if the class is not valid for the type. */
export function degreeRank(type: DegreeTypeValue, cls: DegreeClassValue): number {
  return (classesForType(type) as readonly string[]).indexOf(cls);
}

export const GOMBE_STATE = "Gombe";

export const GOMBE_LGAS = [
  "Akko",
  "Balanga",
  "Billiri",
  "Dukku",
  "Funakaye",
  "Gombe",
  "Kaltungo",
  "Kwami",
  "Nafada",
  "Shongom",
  "Yamaltu/Deba",
] as const;

export const NIGERIAN_STATES = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "Federal Capital Territory",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
] as const;

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
export const ALLOWED_RESUME_MIME = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
} as const;
export const ALLOWED_RESUME_EXTENSIONS = ["pdf", "docx"] as const;

export const COURSE_OTHER = "Other";

export const COURSES = [
  "Accounting",
  "Agricultural Economics",
  "Agricultural Engineering",
  "Agriculture",
  "Anatomy",
  "Animal Science",
  "Arabic",
  "Architecture",
  "Banking and Finance",
  "Biochemistry",
  "Biology",
  "Biotechnology",
  "Botany",
  "Building Technology",
  "Business Administration",
  "Chemical Engineering",
  "Chemistry",
  "Christian Religious Studies",
  "Civil Engineering",
  "Community Health",
  "Computer Engineering",
  "Computer Science",
  "Criminology and Security Studies",
  "Cyber Security",
  "Early Childhood Education",
  "Economics",
  "Education (Arts)",
  "Education (Sciences)",
  "Education (Social Sciences)",
  "Electrical/Electronic Engineering",
  "English Language",
  "Entrepreneurship",
  "Environmental Management",
  "Estate Management",
  "Fine and Applied Arts",
  "Fisheries",
  "Food Science and Technology",
  "Forestry",
  "French",
  "Geography",
  "Geology",
  "Guidance and Counselling",
  "Hausa",
  "Health Information Management",
  "History",
  "Hospitality and Tourism",
  "Human Resource Management",
  "Industrial Chemistry",
  "Information Technology",
  "Islamic Studies",
  "Law",
  "Library and Information Science",
  "Linguistics",
  "Marketing",
  "Mass Communication",
  "Mathematics",
  "Mechanical Engineering",
  "Medical Laboratory Science",
  "Medicine and Surgery",
  "Microbiology",
  "Nursing Science",
  "Office Technology and Management",
  "Pharmacy",
  "Physical and Health Education",
  "Physics",
  "Physiotherapy",
  "Political Science",
  "Primary Education",
  "Psychology",
  "Public Administration",
  "Public Health",
  "Quantity Surveying",
  "Radiography",
  "Science Laboratory Technology",
  "Social Work",
  "Sociology",
  "Software Engineering",
  "Statistics",
  "Surveying and Geoinformatics",
  "Taxation",
  "Theatre Arts",
  "Urban and Regional Planning",
  "Zoology",
] as const;

export const PRIVACY_VERSION = "2026-10";

export const DOCUMENT_TYPES = ["DegreeCertificate", "NyscCertificate", "OriginLetter"] as const;
export type DocumentTypeValue = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_LABELS: Record<DocumentTypeValue, string> = {
  DegreeCertificate: "Degree / diploma certificate",
  NyscCertificate: "NYSC certificate",
  OriginLetter: "State of origin / LGA letter",
};

export const ALLOWED_DOCUMENT_MIME = {
  "application/pdf": ["pdf"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
} as const;
