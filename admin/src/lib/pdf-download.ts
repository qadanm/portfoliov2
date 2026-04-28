// Print-to-PDF helper. Loads a same-origin URL into a hidden iframe, sets
// the iframe document's title (browsers use it as the suggested file name
// in the "Save as PDF" dialog), then fires window.print() inside the
// iframe so the print dialog opens immediately without navigating away.
//
// Why iframe, not a popup window:
//   - No popup-blocker prompts.
//   - User stays on the current page; nothing visibly happens until the
//     print dialog appears.
//   - The iframe is removed after `afterprint` so consecutive prints
//     (resume + letter "download both") don't leak DOM.
//
// Why not a true silent download (jsPDF / html2pdf):
//   - Those libs rasterize text → pixels. Resumes need vector text so
//     ATSes (Workday/Greenhouse/Lever) can parse name, dates, skills.
//     Print-to-PDF preserves real text. We trade one keystroke (Save in
//     the dialog) for a parseable PDF.

interface PrintJob {
  url: string;
  filename: string;
}

export async function printToPdf({ url, filename }: PrintJob): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.style.border = '0';
    // Add a query param so the iframed page knows to skip auto-firing
    // its own print on top of ours, and to skip any once-per-session
    // welcome chrome.
    const sep = url.includes('?') ? '&' : '?';
    iframe.src = `${url}${sep}embed=1`;
    document.body.appendChild(iframe);

    let resolved = false;
    let safety: number | null = null;
    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      if (safety != null) clearTimeout(safety);
      iframe.remove();
      resolve();
    };

    const startPrint = () => {
      const win = iframe.contentWindow;
      const doc = iframe.contentDocument;
      if (!win || !doc) {
        cleanup();
        reject(new Error('iframe has no document'));
        return;
      }
      // Browsers use document.title as the default file name in the
      // print dialog. .pdf is appended automatically.
      doc.title = filename;
      win.addEventListener('afterprint', cleanup);
      // Give the iframe a short window to load fonts and lay out before
      // printing — print fires synchronously off the current state.
      window.setTimeout(() => {
        try {
          win.focus();
          win.print();
        } catch (e) {
          cleanup();
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      }, 350);
    };

    iframe.addEventListener('load', startPrint, { once: true });
    iframe.addEventListener('error', () => {
      cleanup();
      reject(new Error('iframe load error'));
    });

    // Safety net: if afterprint never fires (some clients don't dispatch
    // it on Cancel), reap the iframe after 90 seconds.
    safety = window.setTimeout(cleanup, 90_000);
  });
}

/** Print two documents back-to-back. The second dialog appears after the
 *  first is closed (Save or Cancel both fire afterprint). */
export async function printToPdfSequential(jobs: PrintJob[]): Promise<void> {
  for (const job of jobs) {
    await printToPdf(job);
  }
}
