// One-click silent PDF download. Uses html2pdf.js (jsPDF + html2canvas
// under the hood) to render HTML → canvas → PDF blob → <a download>
// click. No popup, no print dialog, no user confirmation.
//
// Trade-off: text in the resulting PDF is rasterized (pixels, not
// vectors). Recruiters/ATSes can still read it visually but cannot
// search/copy the text or auto-parse fields. Acceptable per user
// preference for "just download the file".
//
// We render BOTH the resume and the cover letter from structured data
// using a self-contained CSS template here. We deliberately don't try
// to fetch /resume/{angle} and reuse its styles — Astro's page-level
// `html`/`body`/`:root` rules clobber our offscreen container's layout
// (canvas comes back at width × 0). Hand-rolled CSS in this module is
// the simplest reliable path.

// @ts-expect-error — html2pdf.js ships permissive types; we only need
// the chained-builder shape so we cast at the call site.
import html2pdf from 'html2pdf.js';
import { buildResume, type Resume } from './engine';
import { generateCoverLetter } from './letters';
import { identity } from '@/data/identity';
import type { Job } from './storage';

// Set window.__qaPdfDebug = true in DevTools to trace the flow.
function log(...args: unknown[]): void {
  if (typeof window === 'undefined') return;
  if (!(window as unknown as { __qaPdfDebug?: boolean }).__qaPdfDebug) return;
  // eslint-disable-next-line no-console
  console.log('[pdf-download]', ...args);
}

const PDF_OPTIONS = {
  margin: [0.5, 0.5, 0.5, 0.5] as [number, number, number, number],
  image: { type: 'jpeg', quality: 0.98 },
  html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false },
  jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function mountOffscreen(innerHtml: string): HTMLDivElement {
  // `position: absolute` instead of `fixed`: html2canvas's clone step
  // gets quirky with fixed positioning (sometimes returns a 0-height
  // canvas), and absolute is visually equivalent for our purposes
  // since we're parking the node far off-screen.
  const container = document.createElement('div');
  container.setAttribute('aria-hidden', 'true');
  container.style.position = 'absolute';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '7.5in';
  container.style.background = '#ffffff';
  container.style.color = '#000000';
  container.innerHTML = innerHtml;
  document.body.appendChild(container);
  return container;
}

async function rasterize(container: HTMLElement, filename: string): Promise<void> {
  // setTimeout(0) instead of requestAnimationFrame: rAF doesn't fire
  // when the tab is backgrounded, which can leave us hung indefinitely.
  // setTimeout(0) is guaranteed to flush layout regardless of tab focus.
  await new Promise<void>((r) => setTimeout(r, 0));
  log('rasterize dims', { w: container.offsetWidth, h: container.offsetHeight, filename });
  await (html2pdf as unknown as () => {
    from: (el: HTMLElement) => {
      set: (opts: Record<string, unknown>) => {
        save: () => Promise<void>;
      };
    };
  })()
    .from(container)
    .set({ ...PDF_OPTIONS, filename: `${filename}.pdf` })
    .save();
}

// ── Resume rendering ─────────────────────────────────────────────────

function resumeStyles(): string {
  return `<style>
    .qa-pdf { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 10.5pt; line-height: 1.45; color: #18181b; padding: 0; background: #ffffff; }
    .qa-pdf .qa-pdf__head { border-bottom: 1px solid rgba(217,119,6,0.4); padding-bottom: 10pt; margin-bottom: 14pt; }
    .qa-pdf .qa-pdf__name { font-family: Georgia, 'Times New Roman', serif; font-size: 22pt; line-height: 1.05; font-weight: 400; letter-spacing: -0.02em; color: #09090b; margin: 0 0 4pt; }
    .qa-pdf .qa-pdf__role { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 9.5pt; letter-spacing: 0.04em; color: #d97706; margin: 0 0 6pt; text-transform: uppercase; }
    .qa-pdf .qa-pdf__kicker { font-size: 11pt; line-height: 1.5; color: #52525b; margin: 0 0 8pt; max-width: 75ch; }
    .qa-pdf .qa-pdf__contact { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 9pt; color: #52525b; margin: 0; }
    .qa-pdf .qa-pdf__section { margin-top: 14pt; }
    .qa-pdf .qa-pdf__h2 { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 9pt; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #52525b; border-bottom: 1px solid #e4e4e7; padding-bottom: 4pt; margin: 0 0 8pt; }
    .qa-pdf .qa-pdf__summary { font-size: 11pt; line-height: 1.6; color: #18181b; margin: 0; max-width: 70ch; }
    .qa-pdf .qa-pdf__job { margin-bottom: 12pt; }
    .qa-pdf .qa-pdf__job:last-child { margin-bottom: 0; }
    .qa-pdf .qa-pdf__job-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12pt; margin-bottom: 2pt; }
    .qa-pdf .qa-pdf__job-title { font-size: 11pt; font-weight: 600; color: #09090b; margin: 0; }
    .qa-pdf .qa-pdf__job-company { font-weight: 400; color: #52525b; }
    .qa-pdf .qa-pdf__job-role { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 9pt; color: #71717a; margin: 0 0 4pt; }
    .qa-pdf .qa-pdf__job-period { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 9pt; color: #71717a; white-space: nowrap; }
    .qa-pdf .qa-pdf__bullets { margin: 4pt 0 0; padding-left: 14pt; }
    .qa-pdf .qa-pdf__bullets li { margin-bottom: 3pt; line-height: 1.5; color: #18181b; font-size: 10pt; }
    .qa-pdf .qa-pdf__bullets li:last-child { margin-bottom: 0; }
    .qa-pdf .qa-pdf__skills { display: grid; grid-template-columns: 100pt 1fr; gap: 4pt 14pt; margin: 0; }
    .qa-pdf .qa-pdf__skill-label { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 8.5pt; letter-spacing: 0.1em; text-transform: uppercase; color: #71717a; padding-top: 2pt; margin: 0; }
    .qa-pdf .qa-pdf__skill-items { font-size: 10pt; line-height: 1.55; color: #18181b; margin: 0; }
  </style>`;
}

function resumeHtml(resume: Resume): string {
  const sitePretty = resume.identity.site.replace(/^https?:\/\//, '');
  return `
    <article class="qa-pdf">
      <header class="qa-pdf__head">
        <h1 class="qa-pdf__name">${escapeHtml(resume.identity.fullName)}</h1>
        <p class="qa-pdf__role">${escapeHtml(resume.angle.label)}</p>
        ${resume.kicker ? `<p class="qa-pdf__kicker">${escapeHtml(resume.kicker)}</p>` : ''}
        <p class="qa-pdf__contact">${escapeHtml(resume.identity.location)} · ${escapeHtml(resume.identity.email)} · ${escapeHtml(sitePretty)} · linkedin.com/in/mqadan · github.com/qadanm</p>
      </header>
      <section class="qa-pdf__section">
        <p class="qa-pdf__summary">${escapeHtml(resume.summary)}</p>
      </section>
      <section class="qa-pdf__section">
        <h2 class="qa-pdf__h2">Experience</h2>
        ${resume.projects.map((p) => `
          <div class="qa-pdf__job">
            <div class="qa-pdf__job-head">
              <h3 class="qa-pdf__job-title">${escapeHtml(p.title)}${p.company ? `<span class="qa-pdf__job-company"> · ${escapeHtml(p.company)}</span>` : ''}</h3>
              <span class="qa-pdf__job-period">${escapeHtml(p.period)}</span>
            </div>
            <p class="qa-pdf__job-role">${escapeHtml(p.role)}${p.location ? ` · ${escapeHtml(p.location)}` : ''}</p>
            <ul class="qa-pdf__bullets">
              ${p.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}
            </ul>
          </div>
        `).join('')}
      </section>
      <section class="qa-pdf__section">
        <h2 class="qa-pdf__h2">Skills</h2>
        <dl class="qa-pdf__skills">
          ${resume.skillGroups.map((g) => `
            <dt class="qa-pdf__skill-label">${escapeHtml(g.label)}</dt>
            <dd class="qa-pdf__skill-items">${escapeHtml(g.items.join(' · '))}</dd>
          `).join('')}
        </dl>
      </section>
    </article>
  `;
}

export async function downloadResumePdf(opts: { angleId: string; filename: string }): Promise<void> {
  log('downloadResumePdf', opts);
  const resume = buildResume(opts.angleId);
  if (!resume) throw new Error(`Unknown resume angle: ${opts.angleId}`);
  const container = mountOffscreen(resumeStyles() + resumeHtml(resume));
  try {
    await rasterize(container, opts.filename);
  } finally {
    container.remove();
  }
  log('resume saved', opts.filename);
}

// ── Letter rendering ─────────────────────────────────────────────────

function letterStyles(): string {
  return `<style>
    .qa-letter { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 11pt; line-height: 1.55; color: #18181b; padding: 0; background: #ffffff; }
    .qa-letter__head { display: flex; align-items: flex-end; justify-content: space-between; gap: 24pt; border-bottom: 1px solid rgba(217,119,6,0.25); padding-bottom: 12pt; margin-bottom: 18pt; }
    .qa-letter__name { font-family: Georgia, 'Times New Roman', serif; font-size: 24pt; line-height: 1.1; color: #09090b; margin: 0; font-weight: 400; letter-spacing: -0.02em; }
    .qa-letter__contact { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 9pt; line-height: 1.55; color: #52525b; text-align: right; }
    .qa-letter__contact > div { margin-bottom: 2pt; }
    .qa-letter__meta { display: flex; justify-content: space-between; gap: 16pt; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 9pt; color: #71717a; margin-bottom: 18pt; }
    .qa-letter__meta-label { text-transform: uppercase; letter-spacing: 0.08em; color: #a1a1aa; font-size: 8pt; margin-bottom: 2pt; }
    .qa-letter__greeting { font-family: Georgia, 'Times New Roman', serif; font-size: 14pt; line-height: 1.3; color: #09090b; margin: 0 0 18pt; font-weight: 400; font-style: italic; }
    .qa-letter__body p { margin: 0 0 12pt; }
    .qa-letter__body p:last-child { margin-bottom: 0; }
    .qa-letter__sign { margin-top: 24pt; padding-top: 14pt; border-top: 1px solid rgba(217,119,6,0.18); font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-size: 13pt; color: #09090b; white-space: pre-line; }
  </style>`;
}

function letterHtml(job: Job): string {
  const text = generateCoverLetter({
    angleId: job.resumeAngle ?? 'product-designer',
    company: job.company || '',
    role: job.role || '',
  });
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const greeting = paragraphs[0] ?? '';
  const signoff = paragraphs[paragraphs.length - 1] ?? '';
  const body = paragraphs.slice(1, -1);

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const sitePretty = identity.site.replace(/^https?:\/\//, '');
  const linkedinPretty = identity.linkedin.replace(/^https?:\/\//, '');
  const githubPretty = identity.github.replace(/^https?:\/\//, '');

  return `
    <article class="qa-letter">
      <header class="qa-letter__head">
        <h1 class="qa-letter__name">${escapeHtml(identity.fullName)}</h1>
        <div class="qa-letter__contact">
          <div>${escapeHtml(identity.location)}</div>
          <div>${escapeHtml(identity.email)}</div>
          <div>${escapeHtml(sitePretty)}</div>
          <div>${escapeHtml(linkedinPretty)}</div>
          <div>${escapeHtml(githubPretty)}</div>
        </div>
      </header>
      <div class="qa-letter__meta">
        <div>
          <div class="qa-letter__meta-label">Date</div>
          ${escapeHtml(today)}
        </div>
        <div style="text-align:right;">
          <div class="qa-letter__meta-label">Re</div>
          ${escapeHtml(job.role || '')} · ${escapeHtml(job.company || '')}
        </div>
      </div>
      <p class="qa-letter__greeting">${escapeHtml(greeting)}</p>
      <div class="qa-letter__body">
        ${body.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}
      </div>
      <div class="qa-letter__sign">${escapeHtml(signoff)}</div>
    </article>
  `;
}

export async function downloadLetterPdf(opts: { job: Job; filename: string }): Promise<void> {
  log('downloadLetterPdf', opts.filename);
  const container = mountOffscreen(letterStyles() + letterHtml(opts.job));
  try {
    await rasterize(container, opts.filename);
  } finally {
    container.remove();
  }
  log('letter saved', opts.filename);
}

// ── Both, sequentially ──────────────────────────────────────────────

export async function downloadBothPdfs(opts: {
  angleId: string;
  resumeFilename: string;
  job: Job;
  letterFilename: string;
}): Promise<void> {
  await downloadResumePdf({ angleId: opts.angleId, filename: opts.resumeFilename });
  // Tiny gap so the two downloads land as separate files instead of
  // getting collapsed into a "files arrived simultaneously" prompt.
  await new Promise((r) => setTimeout(r, 200));
  await downloadLetterPdf({ job: opts.job, filename: opts.letterFilename });
}
