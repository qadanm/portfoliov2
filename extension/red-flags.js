// Hard-coded list of field-label patterns the extension MUST NEVER autofill.
// Used by both content.js (when fields are detected) and popup.js (for the
// "Will not autofill" preview).
//
// Patterns are case-insensitive regex tested against the canonical field
// label (combination of <label> text, name, id, placeholder, aria-label).
//
// This is part of the trust model: the extension is explicit about what it
// won't touch.

const NEVER_AUTOFILL_PATTERNS = [
  /\b(race|ethnicity|hispanic|latin[ao]|caucasian)\b/i,
  /\b(gender|gender\s*identity|pronoun)\b/i,
  /\b(sexual\s*orientation)\b/i,
  /\b(disability|disabled)\b/i,
  /\b(veteran|military|service\s*member)\b/i,
  /\b(date\s*of\s*birth|dob|birth\s*date|age)\b/i,
  /\b(ssn|social\s*security)\b/i,
  /\b(citizenship|citizen|national\s*origin)\b/i,
  /\b(criminal|conviction|felony|misdemeanor|background\s*check)\b/i,
  /\b(drug\s*test|substance)\b/i,
  /\b(religion|religious)\b/i,
  /\b(marital\s*status|married|spouse)\b/i,
];

// Fields where autofill is allowed only with explicit "I have configured this" consent
const SENSITIVE_PATTERNS = [
  /\b(work\s*auth(orization)?|authorized\s*to\s*work)\b/i,
  /\b(sponsorship|visa|h-1b|opt|ead)\b/i,
  /\b(salary|compensation|expected\s*pay|target\s*pay)\b/i,
];

// Make accessible from content scripts
window.__qadanRedFlags = {
  NEVER_AUTOFILL_PATTERNS,
  SENSITIVE_PATTERNS,
  isNeverAutofill(label) {
    if (!label) return false;
    return NEVER_AUTOFILL_PATTERNS.some(p => p.test(label));
  },
  isSensitive(label) {
    if (!label) return false;
    return SENSITIVE_PATTERNS.some(p => p.test(label));
  },
};
