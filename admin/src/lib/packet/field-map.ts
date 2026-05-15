// Field map: a canonical key → value mapping the browser extension uses
// to fill standard fields safely.
//
// Confidence levels:
//   high   = safe to autofill (name, email, phone, links, location)
//   medium = autofill only if user has explicitly enabled (work auth)
//   low    = autofill only with confirmation (years experience, current role)
//   never  = NEVER autofill (demographics, EEOC, work auth without consent)
//
// The extension MUST respect the `confidence` value. The "never" entries
// are included so the extension can show them as "🚫 Will not autofill"
// in its preview UI — being explicit about what we won't touch is part of
// the trust model.

import type { ApplicationPacket, FieldMapEntry, ProfileVault, Job, AtsType } from '../storage';

const FIELD_LABELS: Record<string, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  preferredName: 'Preferred name',
  fullName: 'Full name',
  email: 'Email',
  phone: 'Phone',
  city: 'City',
  state: 'State',
  country: 'Country',
  location: 'Location',
  linkedin: 'LinkedIn',
  portfolio: 'Portfolio',
  github: 'GitHub',
  personalSite: 'Personal site',
  currentEmployer: 'Current employer',
  currentTitle: 'Current title',
  yearsExperience: 'Years of experience',
  remotePreference: 'Remote preference',
  workAuth: 'Work authorization',
  sponsorship: 'Sponsorship required',
  salaryExpectation: 'Salary expectation',
  coverLetterText: 'Cover letter text',
  whyRole: 'Why this role',
  whyCompany: 'Why this company',
  tellMeAboutYourself: 'Tell me about yourself',
  pronouns: 'Pronouns',
  // Demographics — never autofill, included for the explicit "never" entry
  race: 'Race / ethnicity',
  gender: 'Gender',
  sexualOrientation: 'Sexual orientation',
  disability: 'Disability status',
  veteran: 'Veteran status',
  age: 'Age',
  dateOfBirth: 'Date of birth',
  ssn: 'SSN',
  citizenship: 'Citizenship',
  criminalHistory: 'Criminal history',
  source: 'Where did you hear about us',
};

export function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

// Hard-coded "never" list. Even the extension UI explicitly displays these
// as "Will not autofill" so the user knows what the assistant won't do.
export const NEVER_AUTOFILL_KEYS: string[] = [
  'race', 'ethnicity', 'gender', 'genderIdentity', 'sexualOrientation',
  'disability', 'veteran', 'age', 'dateOfBirth', 'ssn', 'citizenship',
  'criminalHistory', 'drugTest', 'religion', 'pronouns',
];

function nameSplit(displayName: string): { first: string; last: string } {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

export function buildFieldMap(
  packet: ApplicationPacket,
  vault: ProfileVault,
  job: Job,
  _ats: AtsType,
): FieldMapEntry[] {
  const out: FieldMapEntry[] = [];
  const { first, last } = nameSplit(vault.displayName || 'Moe Qadan');

  // Names: prefer legal when explicitly provided, fall back to display
  out.push({
    fieldKey: 'firstName',
    value: vault.legalFirstName?.trim() || first,
    confidence: 'high',
    source: 'vault',
  });
  out.push({
    fieldKey: 'lastName',
    value: vault.legalLastName?.trim() || last,
    confidence: 'high',
    source: 'vault',
  });
  out.push({
    fieldKey: 'preferredName',
    value: vault.preferredName?.trim() || vault.displayName?.trim() || 'Moe',
    confidence: 'high',
    source: 'vault',
  });
  out.push({
    fieldKey: 'fullName',
    value: vault.displayName?.trim() || 'Moe Qadan',
    confidence: 'high',
    source: 'vault',
  });

  // Contact
  if (vault.email) out.push({ fieldKey: 'email', value: vault.email, confidence: 'high', source: 'vault' });
  if (vault.phone) out.push({ fieldKey: 'phone', value: vault.phone, confidence: 'high', source: 'vault' });

  // Location
  if (vault.city) out.push({ fieldKey: 'city', value: vault.city, confidence: 'high', source: 'vault' });
  if (vault.state) out.push({ fieldKey: 'state', value: vault.state, confidence: 'high', source: 'vault' });
  if (vault.country) out.push({ fieldKey: 'country', value: vault.country, confidence: 'high', source: 'vault' });
  if (vault.city || vault.state) {
    out.push({
      fieldKey: 'location',
      value: [vault.city, vault.state].filter(Boolean).join(', '),
      confidence: 'high',
      source: 'vault',
    });
  }

  // Links
  if (vault.linkedin) out.push({ fieldKey: 'linkedin', value: vault.linkedin, confidence: 'high', source: 'vault' });
  if (vault.portfolio) out.push({ fieldKey: 'portfolio', value: vault.portfolio, confidence: 'high', source: 'vault' });
  if (vault.github) out.push({ fieldKey: 'github', value: vault.github, confidence: 'high', source: 'vault' });
  if (vault.personalSite) out.push({ fieldKey: 'personalSite', value: vault.personalSite, confidence: 'high', source: 'vault' });

  // Current role
  if (vault.currentEmployer) out.push({
    fieldKey: 'currentEmployer', value: vault.currentEmployer, confidence: 'medium', source: 'vault',
    note: 'Review — may not match what you want to disclose on this app',
  });
  if (vault.currentTitle) out.push({
    fieldKey: 'currentTitle', value: vault.currentTitle, confidence: 'medium', source: 'vault',
  });
  if (vault.yearsExperience != null) out.push({
    fieldKey: 'yearsExperience',
    value: String(vault.yearsExperience),
    confidence: 'low',
    source: 'vault',
    note: 'Verify — many ATS screening questions are knockouts',
  });

  // Remote preference
  out.push({
    fieldKey: 'remotePreference',
    value: vault.remoteOnly ? 'Remote only' : (vault.willingToRelocate ? 'Open to relocation' : 'Open to discussion'),
    confidence: 'medium',
    source: 'vault',
  });

  // Work auth — opt-in only
  if (vault.workAuthAnswer) {
    out.push({
      fieldKey: 'workAuth',
      value: vault.workAuthAnswer,
      confidence: vault.workAuthAutofillAllowed ? 'medium' : 'never',
      source: 'vault',
      note: vault.workAuthAutofillAllowed
        ? 'Verify each application — answer may differ by role'
        : 'Autofill disabled in vault. Answer manually.',
    });
  }
  if (vault.sponsorshipAnswer) {
    out.push({
      fieldKey: 'sponsorship',
      value: vault.sponsorshipAnswer,
      confidence: vault.workAuthAutofillAllowed ? 'medium' : 'never',
      source: 'vault',
      note: 'Sponsorship answers can change per company. Verify.',
    });
  }

  // Salary — never auto-commit, but the line is available for copy
  if (packet.salaryGuidance) {
    out.push({
      fieldKey: 'salaryExpectation',
      value: packet.salaryGuidance,
      confidence: 'low',
      source: 'packet',
      note: 'Read before pasting. Do not commit to a number here.',
    });
  }

  // Packet text fields — these come from the packet, not the vault
  if (packet.coverLetter) {
    out.push({
      fieldKey: 'coverLetterText',
      value: packet.coverLetter,
      confidence: 'low',
      source: 'packet',
      note: 'Tailored per job. Review before pasting.',
    });
  }
  if (packet.whyRoleAnswer) {
    out.push({ fieldKey: 'whyRole', value: packet.whyRoleAnswer, confidence: 'low', source: 'packet' });
  }
  if (packet.whyCompanyAnswer) {
    out.push({ fieldKey: 'whyCompany', value: packet.whyCompanyAnswer, confidence: 'low', source: 'packet' });
  }
  if (packet.tellMeAboutYourself) {
    out.push({ fieldKey: 'tellMeAboutYourself', value: packet.tellMeAboutYourself, confidence: 'low', source: 'packet' });
  }

  // Source ("where did you hear about us") — set if the job has source data
  if (job.source) {
    out.push({ fieldKey: 'source', value: job.source, confidence: 'medium', source: 'job' });
  }

  // Explicit "never" entries (always present so the extension UI can render
  // them as "Will not autofill"):
  for (const key of NEVER_AUTOFILL_KEYS) {
    out.push({
      fieldKey: key,
      value: '',
      confidence: 'never',
      source: 'vault',
      note: 'Never autofilled. Answer manually if you choose to.',
    });
  }

  return out;
}

export function safeFieldsFor(map: FieldMapEntry[]): FieldMapEntry[] {
  return map.filter(e => e.confidence === 'high');
}
