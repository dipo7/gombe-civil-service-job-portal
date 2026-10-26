import type { Metadata } from "next";
import { PRIVACY_VERSION } from "@/lib/constants";
import { PORTAL_NAME } from "@/lib/brand";

export const metadata: Metadata = { title: "Privacy Notice" };
export const dynamic = "force-dynamic";

// Draft text for the Nigeria Data Protection Act 2023; have counsel / the DPO review before launch.
export default function PrivacyPage() {
  const contact = process.env.PRIVACY_CONTACT_EMAIL;
  const retentionOut = process.env.RETENTION_SCREENED_OUT_DAYS ?? "90";
  const retentionAll = process.env.RETENTION_APPLICATIONS_DAYS ?? "365";

  return (
    <article className="prose-sm mx-auto max-w-3xl space-y-5 text-sm leading-relaxed">
      <h1 className="text-3xl font-bold tracking-tight">Privacy Notice</h1>
      <p className="text-muted-foreground">Version {PRIVACY_VERSION}</p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Who we are</h2>
        <p>
          The {PORTAL_NAME} is operated by the Gombe State Civil Service Commission (&ldquo;we&rdquo;) and is the data
          controller for the personal data you submit when you apply for a position.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">What we collect</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Identity and contact details: full name, email address, phone number.</li>
          <li>Eligibility details: state of origin, local government area, date of birth.</li>
          <li>Qualifications: degree type and class, course, institution, graduation year.</li>
          <li>Documents you upload: resume, degree certificate, NYSC certificate, state of origin or LGA letter.</li>
          <li>Technical data: IP address and timestamps, used for security and abuse prevention.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">How we use it</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>To assess your eligibility for the position against its published requirements, including an automated check of age, origin, and qualification criteria.</li>
          <li>To let authorised Civil Service Commission staff review, shortlist, and contact candidates.</li>
          <li>To send you a confirmation and verification email.</li>
          <li>To detect fraud, duplicate applications, and misuse of the portal.</li>
        </ul>
        <p>
          Our lawful bases are your consent (given when you submit the form) and our public duty to run fair recruitment.
          Applications that do not meet the stated criteria are not forwarded to hiring staff, and the outcome of the
          automated check is not shown on screen. You may ask for a human review of that outcome by contacting us.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Who can see it</h2>
        <p>
          Only authorised Commission administrators and the HR officer assigned to the position. Access to applications and
          documents is logged. We use service providers for hosting, file storage, email delivery, and bot protection; they
          process data only on our instructions. Documents are stored in private storage and are scanned for malware.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">How long we keep it</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Applications that did not meet the criteria: deleted after {retentionOut} days.</li>
          <li>All other applications and their documents: deleted after {retentionAll} days.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Your rights</h2>
        <p>
          Under the Nigeria Data Protection Act 2023 you may request access to, correction of, or deletion of your data,
          object to or restrict its processing, withdraw consent, and complain to the Nigeria Data Protection Commission.
          Quote your application reference number when you write to us.
        </p>
        <p>
          Contact:{" "}
          {contact ? (
            <a href={`mailto:${contact}`} className="text-primary underline">
              {contact}
            </a>
          ) : (
            "the Data Protection Officer, Gombe State Civil Service Commission"
          )}
          .
        </p>
      </section>
    </article>
  );
}
