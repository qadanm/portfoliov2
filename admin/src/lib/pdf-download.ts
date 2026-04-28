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

/** Open both docs in two new tabs. Must be called inside a single
 *  click handler so user activation covers both window.open calls. */
export function openBothForPrint(jobs: [PdfJob, PdfJob]): void {
  const opened: Window[] = [];
  for (const job of jobs) {
    const w = window.open(buildAutoprintUrl(job), '_blank');
    if (!w) {
      // If the second open is blocked, close the first so we don't
      // leave a half-finished state on screen.
      for (const o of opened) { try { o.close(); } catch { /* swallow */ } }
      throw new Error('Browser blocked one of the new tabs. Allow popups for this site.');
    }
    opened.push(w);
  }
}
