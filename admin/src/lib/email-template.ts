/**
 * Branded outreach email template — renders Gmail-safe HTML matching qadan.co.
 *
 * Constraints (deliberate, do not "fix"):
 * - No <style>, no CSS variables, no media queries: many clients strip them.
 * - Tables for layout: flexbox/grid is unreliable in Outlook and older Apple Mail.
 * - Inline styles only, with `bgcolor`/`color` attributes mirrored on tables for old Outlook.
 * - No web fonts: Google Fonts only render in some clients. Georgia + system-ui is the design.
 * - No external images: avoids broken-image risk in clients that block remote content.
 * - Output is a fragment (no <html>/<head>/<body>): pasted into Gmail compose, not a full doc.
 */
export type Variant = 'recruiter' | 'hiring-manager' | 'follow-up' | 'project';

export type CtaKey = 'portfolio' | 'resume' | 'case-studies' | 'book-call';

export interface RenderInput {
  variant: Variant;
  recipientFirstName: string;
  company?: string;
  role?: string;
  /** Body copy, paragraph breaks via \n\n. */
  body: string;
  ctas: CtaKey[];
  /** Sign-off line above name, e.g. "Best,". */
  signOff?: string;
}

export interface RenderOutput {
  /** Gmail-safe HTML fragment to paste into compose body. */
  html: string;
  /** Plain-text fallback (for the text/plain clipboard slot or paste into clients that prefer it). */
  plainText: string;
  /** Just the signature block as standalone HTML. */
  signatureHtml: string;
  /** Suggested subject line (user pastes into Gmail's subject field). */
  subject: string;
}

const COLORS = {
  bg: '#FAFAF9',
  surface: '#FFFFFF',
  text: '#09090B',
  textMuted: '#52525B',
  textSubtle: '#A1A1AA',
  border: '#E4E4E7',
  borderSubtle: '#F0F0F1',
  accent: '#D97706',
  accentMuted: 'rgba(217, 119, 6, 0.1)',
} as const;

const FONTS = {
  display:
    "Georgia, 'Times New Roman', 'Iowan Old Style', 'Apple Garamond', 'Palatino Linotype', serif",
  body:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, 'Helvetica Neue', Helvetica, Arial, sans-serif",
  mono:
    "'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
} as const;

const IDENTITY = {
  name: 'Moe Qadan',
  title: 'Product Designer · UX Engineer',
  location: 'Los Angeles',
  email: 'moe@qadan.co',
  site: 'qadan.co',
  siteUrl: 'https://qadan.co',
  linkedinUrl: 'https://linkedin.com/in/mqadan',
  linkedinLabel: 'linkedin.com/in/mqadan',
  githubUrl: 'https://github.com/qadanm',
  githubLabel: 'github.com/qadanm',
} as const;

const CTA_DEFS: Record<CtaKey, { label: string; href: string }> = {
  portfolio: { label: 'View portfolio', href: 'https://qadan.co' },
  resume: { label: 'View resume', href: 'https://qadan.co/resume' },
  'case-studies': { label: 'Case studies', href: 'https://qadan.co/work' },
  'book-call': { label: 'Book a call', href: 'mailto:moe@qadan.co?subject=Quick%20intro%20call' },
};

const VARIANT_DEFS: Record<
  Variant,
  { label: string; subjectFor: (i: RenderInput) => string; defaultCtas: CtaKey[]; starterBody: (i: Pick<RenderInput, 'recipientFirstName' | 'company' | 'role'>) => string }
> = {
  recruiter: {
    label: 'Recruiter outreach',
    subjectFor: (i) =>
      i.role && i.company
        ? `Re: ${i.role} — short intro from Moe Qadan`
        : i.company
          ? `Quick intro — Moe Qadan × ${i.company}`
          : 'Quick intro from Moe Qadan',
    defaultCtas: ['portfolio', 'resume'],
    starterBody: (i) =>
      [
        `Hope your week is going well. I came across ${i.company || '[company]'}${i.role ? ` and the ${i.role} role` : ''} and wanted to reach out directly.`,
        `I lead product design and front-end systems — most recently shipping AI-native interfaces and design systems used by teams. Portfolio + resume below for the quick read.`,
        `Open to a 15-minute intro this week or next if it's a fit. Either way, thanks for your time.`,
      ].join('\n\n'),
  },
  'hiring-manager': {
    label: 'Hiring manager',
    subjectFor: (i) =>
      i.role && i.company
        ? `${i.role} at ${i.company} — Moe Qadan`
        : i.role
          ? `${i.role} — Moe Qadan`
          : 'Hello from Moe Qadan',
    defaultCtas: ['portfolio', 'case-studies'],
    starterBody: (i) =>
      [
        `Hope this finds you well. I'm Moe — a product designer and UX engineer based in LA, and I'd love to be considered for ${i.role ? `the ${i.role} role` : 'the role'}${i.company ? ` at ${i.company}` : ''}.`,
        `I sit between design and engineering: I design the system, prototype the interactions, and ship the production code. Recent work covers AI-native chat surfaces, design systems, and data-heavy dashboards.`,
        `Happy to walk you through a case study if there's interest — links below for context.`,
      ].join('\n\n'),
  },
  'follow-up': {
    label: 'Follow-up',
    subjectFor: (i) =>
      i.role && i.company
        ? `Re: ${i.role} — quick follow-up`
        : i.company
          ? `Following up — ${i.company}`
          : 'Following up',
    defaultCtas: ['portfolio'],
    starterBody: (i) =>
      [
        `Just floating this back up in case it slipped through${i.company ? ` — wanted to keep ${i.company} on my radar` : ''}.`,
        `No pressure if the timing isn't right. If it helps, the most relevant work is linked below for a quick scan.`,
        `Happy to chat whenever it makes sense.`,
      ].join('\n\n'),
  },
  project: {
    label: 'Project inquiry',
    subjectFor: (i) =>
      i.company ? `Working with ${i.company} — Moe Qadan` : 'Project — Moe Qadan',
    defaultCtas: ['portfolio', 'book-call'],
    starterBody: (i) =>
      [
        `Saw what you're building${i.company ? ` at ${i.company}` : ''} and wanted to introduce myself. I design and build product surfaces — usually where the interaction model is the hard part (AI, real-time data, complex flows).`,
        `If you've got something on the roadmap that needs a designer who can also ship the front-end, I'd be glad to talk through it.`,
        `Portfolio + a 15-min call link below — whichever's easier.`,
      ].join('\n\n'),
  },
};

export function variantOptions(): Array<{ value: Variant; label: string }> {
  return (Object.keys(VARIANT_DEFS) as Variant[]).map((v) => ({ value: v, label: VARIANT_DEFS[v].label }));
}

export function defaultsFor(variant: Variant, input: Pick<RenderInput, 'recipientFirstName' | 'company' | 'role'>): { subject: string; body: string; ctas: CtaKey[] } {
  const def = VARIANT_DEFS[variant];
  return {
    subject: def.subjectFor({ ...input, variant, body: '', ctas: [] }),
    body: def.starterBody(input),
    ctas: [...def.defaultCtas],
  };
}

export function ctaOptions(): Array<{ value: CtaKey; label: string }> {
  return (Object.keys(CTA_DEFS) as CtaKey[]).map((v) => ({ value: v, label: CTA_DEFS[v].label }));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function paragraphsHtml(body: string): string {
  const paragraphStyle = `margin:0 0 18px;font-family:${FONTS.body};font-size:16px;line-height:1.65;color:${COLORS.text};`;
  return body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="${paragraphStyle}">${escapeHtml(p).replace(/\n/g, '<br />')}</p>`)
    .join('');
}

function ctasHtml(ctas: CtaKey[]): string {
  if (ctas.length === 0) return '';
  // Pill buttons rendered as <a> with table-cell padding; bgcolor mirrored for Outlook.
  const cells = ctas
    .map((key, idx) => {
      const def = CTA_DEFS[key];
      const isPrimary = idx === 0;
      const bg = isPrimary ? COLORS.text : COLORS.surface;
      const fg = isPrimary ? COLORS.surface : COLORS.text;
      const border = isPrimary ? COLORS.text : COLORS.border;
      return `<td style="padding:0 10px 10px 0;" valign="top"><a href="${def.href}" style="display:inline-block;padding:11px 20px;background-color:${bg};color:${fg};border:1px solid ${border};border-radius:9999px;font-family:${FONTS.body};font-size:14px;font-weight:500;line-height:1;text-decoration:none;letter-spacing:-0.005em;" bgcolor="${bg}">${escapeHtml(def.label)}</a></td>`;
    })
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 28px;border-collapse:collapse;"><tr>${cells}</tr></table>`;
}

function dividerHtml(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:8px 0 22px;"><tr><td style="border-top:1px solid ${COLORS.borderSubtle};line-height:0;font-size:0;height:1px;">&nbsp;</td></tr></table>`;
}

export function renderSignature(): string {
  // Self-contained signature block — also returned standalone for "copy signature only".
  const nameStyle = `font-family:${FONTS.display};font-size:22px;font-weight:400;letter-spacing:-0.015em;color:${COLORS.text};line-height:1.15;`;
  const metaStyle = `font-family:${FONTS.body};font-size:14px;color:${COLORS.textMuted};line-height:1.6;`;
  const linkStyle = `color:${COLORS.text};text-decoration:underline;text-decoration-color:${COLORS.accentMuted};text-underline-offset:3px;`;
  const dotStyle = `display:inline-block;color:${COLORS.textSubtle};padding:0 6px;`;

  return [
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">`,
    `<tr><td style="${nameStyle}padding-bottom:6px;">Moe Qadan<span style="color:${COLORS.accent};">.</span></td></tr>`,
    `<tr><td style="${metaStyle}padding-bottom:2px;">${escapeHtml(IDENTITY.title)}</td></tr>`,
    `<tr><td style="${metaStyle}padding-bottom:14px;">${escapeHtml(IDENTITY.location)}</td></tr>`,
    `<tr><td style="${metaStyle}">`,
    `<a href="mailto:${IDENTITY.email}" style="${linkStyle}">${IDENTITY.email}</a>`,
    `<span style="${dotStyle}">·</span>`,
    `<a href="${IDENTITY.siteUrl}" style="${linkStyle}">${IDENTITY.site}</a>`,
    `<span style="${dotStyle}">·</span>`,
    `<a href="${IDENTITY.linkedinUrl}" style="${linkStyle}">LinkedIn</a>`,
    `<span style="${dotStyle}">·</span>`,
    `<a href="${IDENTITY.githubUrl}" style="${linkStyle}">GitHub</a>`,
    `</td></tr>`,
    `</table>`,
  ].join('');
}

export function render(input: RenderInput): RenderOutput {
  const variantDef = VARIANT_DEFS[input.variant];
  const subject = variantDef.subjectFor(input);

  const greetingName = input.recipientFirstName.trim() || 'there';
  const signOff = (input.signOff?.trim() || 'Best').replace(/[,.]+$/, '');

  // Headline uses serif. Greeting itself stays modest; the visual heft is the wordmark + body.
  const greetingStyle = `font-family:${FONTS.display};font-size:28px;font-weight:400;letter-spacing:-0.015em;color:${COLORS.text};line-height:1.2;margin:0 0 18px;`;
  const eyebrowStyle = `font-family:${FONTS.mono};font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:${COLORS.textSubtle};margin:0 0 22px;`;
  const wordmarkStyle = `font-family:${FONTS.display};font-size:22px;font-weight:400;letter-spacing:-0.015em;color:${COLORS.text};line-height:1;margin:0;`;
  const signOffStyle = `margin:6px 0 22px;font-family:${FONTS.body};font-size:16px;line-height:1.65;color:${COLORS.text};`;

  // Outer table provides the canvas color (renders cleanly when forwarded). Inner table caps width at 600px,
  // a long-standing email convention that survives most preview panes and mobile.
  const html = [
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${COLORS.bg}" style="background-color:${COLORS.bg};border-collapse:collapse;">`,
    `<tr><td align="center" style="padding:32px 16px;">`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;border-collapse:collapse;background-color:${COLORS.surface};border:1px solid ${COLORS.borderSubtle};border-radius:14px;" bgcolor="${COLORS.surface}">`,
    `<tr><td style="padding:36px 40px 8px;">`,
    `<p style="${wordmarkStyle}">Moe Qadan<span style="color:${COLORS.accent};">.</span></p>`,
    `</td></tr>`,
    `<tr><td style="padding:24px 40px 0;">`,
    `<p style="${eyebrowStyle}">${escapeHtml(variantDef.label)}</p>`,
    `<p style="${greetingStyle}">Hi ${escapeHtml(greetingName)},</p>`,
    paragraphsHtml(input.body),
    ctasHtml(input.ctas),
    `<p style="${signOffStyle}">${escapeHtml(signOff)},</p>`,
    `</td></tr>`,
    `<tr><td style="padding:0 40px 36px;">`,
    dividerHtml(),
    renderSignature(),
    `</td></tr>`,
    `</table>`,
    `</td></tr>`,
    `</table>`,
  ].join('');

  return {
    html,
    plainText: renderPlainText(input, signOff, greetingName),
    signatureHtml: renderSignature(),
    subject,
  };
}

function renderPlainText(input: RenderInput, signOff: string, greetingName: string): string {
  const lines: string[] = [];
  lines.push(`Hi ${greetingName},`, '');
  lines.push(input.body.trim(), '');
  if (input.ctas.length > 0) {
    for (const key of input.ctas) {
      const def = CTA_DEFS[key];
      lines.push(`${def.label}: ${def.href}`);
    }
    lines.push('');
  }
  lines.push(`${signOff},`, '');
  lines.push('— Moe Qadan');
  lines.push(`${IDENTITY.title} · ${IDENTITY.location}`);
  lines.push(`${IDENTITY.email} · ${IDENTITY.site}`);
  lines.push(`LinkedIn: ${IDENTITY.linkedinLabel}`);
  lines.push(`GitHub: ${IDENTITY.githubLabel}`);
  return lines.join('\n');
}
