/** Parses strict YYYY-MM-DD into a UTC-midnight Date, or null if invalid. */
export function parseIsoDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date;
}

/** Full years elapsed between dob and the reference date (defaults to now), UTC-based. */
export function calculateAge(dob: Date, reference: Date = new Date()): number {
  let age = reference.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = reference.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && reference.getUTCDate() < dob.getUTCDate())) age -= 1;
  return age;
}
