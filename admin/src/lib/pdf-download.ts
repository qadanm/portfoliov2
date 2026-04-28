// Print-to-PDF helper. Loads a same-origin URL into a hidden iframe sized
// to Letter paper, waits for the iframed page to signal it's done
// rendering, then fires window.print() inside the iframe so the print
// dialog opens with the right content and the right filename.
//
// Why iframe + postMessage handshake (not just iframe.load + a timer):
//   - The iframed page (resume / letter) finishes the inline `load`
//     event well before its own scripts have rendered the body. Firing
//     print() too early gets a blank dialog or no dialog at all.
//   - Astro hoists scripts and re-runs them on hydration, which can
//     happen any time after `load`. We have no reliable fixed delay
//     that's correct on every device.
//   - So the iframed page tells us when it's ready via postMessage.
//
// Why not jsPDF/html2canvas:
//   - Those rasterize text → pixels. Resumes need vector text so ATSes
//     (Workday/Greenhouse/Lever) can parse name, dates, skills.
//
// Why a Letter-sized iframe and not 1×1px:
//   - Chrome computes print layout from the iframe's dimensions. A 1px
//     iframe produces zero printable pages and the dialog is suppressed.

interface PrintJob {
  url: string;
  filename: string;
}

const READY_TIMEOUT_MS = 8_000;
const SAFETY_TIMEOUT_MS = 90_000;

// Set window.__qaPdfDebug = true in DevTools to trace the print flow.
function log(...args: unknown[]): void {
  if (typeof window === 'undefined') return;
  if (!(window as unknown as { __qaPdfDebug?: boolean }).__qaPdfDebug) return;
  // eslint-disable-next-line no-console
  console.log('[pdf-download]', ...args);
}

export async function printToPdf({ url, filename }: PrintJob): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    log('printToPdf start', { url, filename });

    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    // Letter paper size; offscreen but laid out. Chrome won't render an
    // empty-dimensioned iframe as "printable", so we need real dimensions.
    iframe.style.position = 'fixed';
    iframe.style.left = '-10000px';
    iframe.style.top = '0';
    iframe.style.width = '8.5in';
    iframe.style.height = '11in';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';

    const sep = url.includes('?') ? '&' : '?';
    iframe.src = `${url}${sep}embed=1&autoprint=1&filename=${encodeURIComponent(filename)}`;

    let resolved = false;
    let safetyTimer: number | null = null;
    let readyTimer: number | null = null;

    const cleanup = (reason: string) => {
      if (resolved) return;
      resolved = true;
      log('cleanup', reason);
      window.removeEventListener('message', onMessage);
      if (safetyTimer != null) clearTimeout(safetyTimer);
      if (readyTimer != null) clearTimeout(readyTimer);
      // Defer removal so the print job has a tick to finalize.
      setTimeout(() => iframe.remove(), 100);
      resolve();
    };

    const fail = (err: unknown) => {
      if (resolved) return;
      resolved = true;
      log('fail', err);
      window.removeEventListener('message', onMessage);
      if (safetyTimer != null) clearTimeout(safetyTimer);
      if (readyTimer != null) clearTimeout(readyTimer);
      iframe.remove();
      reject(err instanceof Error ? err : new Error(String(err)));
    };

    const firePrint = () => {
      const win = iframe.contentWindow;
      const doc = iframe.contentDocument;
      if (!win || !doc) {
        fail(new Error('iframe has no contentWindow/document'));
        return;
      }
      // Set the title so the print dialog uses it as the suggested file
      // name (".pdf" is appended by the browser).
      doc.title = filename;
      log('firing print()', { docTitle: doc.title });
      win.addEventListener('afterprint', () => cleanup('afterprint'), { once: true });
      try {
        win.focus();
        win.print();
      } catch (e) {
        fail(e);
      }
    };

    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string } | null;
      if (!data || data.type !== 'qa-print-ready') return;
      // Same-origin and content-window identity tend to differ across
      // Astro/Vite dev (proxies) and prod, so we trust origin + data
      // shape rather than checking e.source === iframe.contentWindow.
      if (e.origin !== location.origin) return;
      log('received qa-print-ready');
      if (readyTimer != null) {
        clearTimeout(readyTimer);
        readyTimer = null;
      }
      firePrint();
    };
    window.addEventListener('message', onMessage);

    iframe.addEventListener('load', () => {
      log('iframe load fired');
      // Fallback: if the iframed page never sends qa-print-ready (older
      // version without the autoprint hook, or a JS error), just fire
      // print after a generous delay so the user still gets a dialog.
      readyTimer = window.setTimeout(() => {
        log('ready signal timed out, firing anyway');
        firePrint();
      }, READY_TIMEOUT_MS);
    }, { once: true });

    iframe.addEventListener('error', () => fail(new Error('iframe load error')));

    document.body.appendChild(iframe);

    // Outermost safety net: reap iframe even if afterprint never fires
    // (some print drivers don't dispatch it on Cancel).
    safetyTimer = window.setTimeout(() => cleanup('safety timeout'), SAFETY_TIMEOUT_MS);
  });
}

/** Print two documents back-to-back. The second dialog appears after the
 *  first finishes (Save or Cancel both fire afterprint). */
export async function printToPdfSequential(jobs: PrintJob[]): Promise<void> {
  for (const job of jobs) {
    await printToPdf(job);
  }
}
