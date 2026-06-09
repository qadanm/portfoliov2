// One-click PDF "download" via the browser's native print engine.
//
// We open /resume/{angle} or /letter/?id=... in a new tab with an
// autoprint flag. The page sets document.title (so it becomes the
// dialog's default file name), fires window.print() once it has
// rendered, and closes itself when the dialog is dismissed.
//
// Why this beats every other approach we tried:
//   - Iframe → blocked by Cloudflare Access's X-Frame-Options: deny.
//   - Popup window (width/height set) → Chrome treats it as a popup.
//     Less common to allow than a normal tab.
//   - Client-side jsPDF/html2canvas → text is rasterized to pixels,
//     ATSes can't parse it, recruiters can't search/copy.
//   - Server-side Browser Rendering → paid, infra to maintain.
//
// What we land on:
//   - window.open(url, '_blank') from the click handler → regular new
//     tab, user activation carries through.
//   - The new tab fires print() on its own. Vector PDFs from the
//     browser's print engine. Fully ATS-readable.
//   - The user has one extra click ("Save") in the print dialog. We
//     accept that cost in exchange for simplicity and ATS support.

interface PdfJob {
  url: string;
  filename: string;
}

function buildAutoprintUrl({ url, filename }: PdfJob): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}embed=1&autoprint=1&filename=${encodeURIComponent(filename)}`;
}

/** Open the doc in a new tab with autoprint enabled. The tab handles
 *  the rest — show resume/letter, fire print(), auto-close. */
export function openForPrint(job: PdfJob): void {
  const win = window.open(buildAutoprintUrl(job), '_blank');
  if (!win) {
    // Some browsers/extensions block window.open even from click
    // handlers. Surface a clear error so the caller can toast.
    throw new Error('Browser blocked the new tab. Allow popups for this site.');
  }
}

/** Open BOTH docs in ONE new tab, stacked with a page break, so a single
 *  print dialog covers both. Two `window.open` calls in one click reliably
 *  lose to the popup blocker (only the first carries user activation), so
 *  we open one blank tab synchronously and compose into it. */
export function openBothForPrint(jobs: [PdfJob, PdfJob]): void {
  const win = window.open('', '_blank');
  if (!win) {
    throw new Error('Browser blocked the new tab. Allow popups for this site.');
  }
  try { win.document.write('<title>Preparing documents…</title><p style="font-family:sans-serif">Preparing both documents…</p>'); } catch { /* ignore */ }
  void composeAndPrint(win, jobs);
}

function buildEmbedUrl({ url }: PdfJob): string {
  const sep = url.includes('?') ? '&' : '?';
  // embed=1 strips admin chrome; NO autoprint — the composed page fires
  // a single print() itself.
  return `${url}${sep}embed=1`;
}

async function composeAndPrint(win: Window, jobs: [PdfJob, PdfJob]): Promise<void> {
  try {
    const docs = await Promise.all(jobs.map(async (job) => {
      const res = await fetch(buildEmbedUrl(job), { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`Could not load ${job.url} (${res.status})`);
      return new DOMParser().parseFromString(await res.text(), 'text/html');
    }));

    // Hoist styles from both documents (dedup), drop all scripts.
    const seen = new Set<string>();
    const styleTags: string[] = [];
    for (const doc of docs) {
      doc.querySelectorAll('script').forEach(s => s.remove());
      doc.head.querySelectorAll('style, link[rel="stylesheet"]').forEach(n => {
        const html = n.outerHTML;
        if (!seen.has(html)) { seen.add(html); styleTags.push(html); }
      });
    }
    const bodyClass = Array.from(new Set(docs.flatMap(d => (d.body.className || '').split(/\s+/)))).filter(Boolean).join(' ');
    const title = `${jobs[0].filename} + ${jobs[1].filename}`;

    win.document.open();
    win.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<base href="${location.origin}/" />
<title>${title.replace(/[<>&"]/g, '')}</title>
${styleTags.join('\n')}
<style>.qa-print-break { page-break-before: always; break-before: page; }</style>
</head>
<body class="${bodyClass.replace(/"/g, '')}">
${docs[0].body.innerHTML}
<div class="qa-print-break"></div>
${docs[1].body.innerHTML}
</body>
</html>`);
    win.document.close();

    // Let styles/fonts settle, then ONE print dialog for both documents.
    const fire = () => { try { win.focus(); win.print(); } catch { /* ignore */ } };
    try {
      const fonts = (win.document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
      if (fonts?.ready) {
        await Promise.race([fonts.ready, new Promise(r => setTimeout(r, 1500))]);
      }
    } catch { /* ignore */ }
    setTimeout(fire, 400);
    win.addEventListener('afterprint', () => { try { win.close(); } catch { /* ignore */ } });
  } catch (err) {
    // Compose failed — leave the tab usable with direct links so the user
    // can still print each doc individually (clicks inside the tab carry
    // their own activation).
    try {
      win.document.open();
      win.document.write(`<!doctype html><title>Print failed</title>
<body style="font-family: sans-serif; padding: 24px;">
<p>Could not combine the documents (${String((err as Error)?.message ?? err).replace(/[<>&"]/g, '')}).</p>
<p>Open and print each one:</p>
<ul>
<li><a href="${buildAutoprintUrl(jobs[0]).replace(/"/g, '&quot;')}">${jobs[0].filename.replace(/[<>&"]/g, '')}</a></li>
<li><a href="${buildAutoprintUrl(jobs[1]).replace(/"/g, '&quot;')}">${jobs[1].filename.replace(/[<>&"]/g, '')}</a></li>
</ul>
</body>`);
      win.document.close();
    } catch { /* ignore */ }
  }
}
