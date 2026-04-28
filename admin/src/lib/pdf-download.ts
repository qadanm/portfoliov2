// Print-to-PDF helper. Opens the doc in a popup window with ?autoprint=1.
// The popup page (resume/letter):
//   1. detects ?autoprint=1
//   2. sets document.title from the filename param (used as the print
//      dialog's suggested file name)
//   3. waits for content to render
//   4. fires window.print()
//   5. on afterprint (or safety timeout), postMessages 'qa-print-done'
//      to window.opener and calls window.close()
//
// Why popup, not iframe:
//   admin.qadan.co serves `X-Frame-Options: deny` via Cloudflare Access.
//   That blocks ALL framing — same-origin included — so iframe-based
//   print never displayed in production. Popups are separate top-level
//   windows and aren't affected by X-Frame-Options.
//
// Why not a true silent download (jsPDF / html2canvas):
//   - Those rasterize text → pixels. Resumes need vector text so ATSes
//     (Workday/Greenhouse/Lever) can parse name, dates, skills.
//
// Trade-offs we accept:
//   - User briefly sees the popup window flash before it auto-closes.
//   - Popup blocker may interrupt the first time on some browsers; the
//     user can allow popups for the site once.
//   - For "both", we open BOTH popups inside the same click handler so
//     they share user activation. Chrome queues print dialogs from
//     multiple windows (one shows, the next waits).

interface PrintJob {
  url: string;
  filename: string;
}

const POPUP_FEATURES = 'width=900,height=1100,scrollbars=yes,resizable=yes';
const SAFETY_TIMEOUT_MS = 120_000;

// Set window.__qaPdfDebug = true in DevTools to trace the print flow.
function log(...args: unknown[]): void {
  if (typeof window === 'undefined') return;
  if (!(window as unknown as { __qaPdfDebug?: boolean }).__qaPdfDebug) return;
  // eslint-disable-next-line no-console
  console.log('[pdf-download]', ...args);
}

function buildPopupUrl({ url, filename }: PrintJob): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}embed=1&autoprint=1&filename=${encodeURIComponent(filename)}`;
}

/** Wait for a popup to send 'qa-print-done' or to be closed manually,
 *  whichever comes first. Resolves regardless — caller doesn't need to
 *  distinguish (Save and Cancel both produce the same outcome here). */
function awaitPopupDone(win: Window): Promise<void> {
  return new Promise<void>((resolve) => {
    let resolved = false;
    const finish = (reason: string) => {
      if (resolved) return;
      resolved = true;
      log('finish', reason);
      window.removeEventListener('message', onMessage);
      clearInterval(closedCheck);
      clearTimeout(safety);
      resolve();
    };

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== location.origin) return;
      if (e.source !== win) return;
      const data = e.data as { type?: string } | null;
      if (data?.type === 'qa-print-done') finish('qa-print-done');
    };
    window.addEventListener('message', onMessage);

    const closedCheck = window.setInterval(() => {
      if (win.closed) finish('window.closed');
    }, 500);

    const safety = window.setTimeout(() => {
      try { if (!win.closed) win.close(); } catch { /* swallow */ }
      finish('safety');
    }, SAFETY_TIMEOUT_MS);
  });
}

export async function printToPdf(job: PrintJob): Promise<void> {
  log('printToPdf start', job);
  const win = window.open(
    buildPopupUrl(job),
    `qa-print-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    POPUP_FEATURES,
  );
  if (!win) {
    throw new Error('Popup blocked. Allow popups for this site and try again.');
  }
  await awaitPopupDone(win);
}

/** Open BOTH popups in the same synchronous click handler so they share
 *  user activation (later window.open calls would be blocked by the
 *  popup blocker once the activation lapses). Chrome queues their
 *  print dialogs — the user sees them one after the other. */
export async function printToPdfPair(jobs: [PrintJob, PrintJob]): Promise<void> {
  log('printToPdfPair start', jobs);
  const wins: Window[] = [];
  for (const job of jobs) {
    const w = window.open(
      buildPopupUrl(job),
      `qa-print-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      POPUP_FEATURES,
    );
    if (!w) {
      // Roll back — close any popup we already opened so the user
      // doesn't end up with a half-baked state.
      for (const opened of wins) { try { opened.close(); } catch { /* swallow */ } }
      throw new Error('Popup blocked. Allow popups for this site and try again.');
    }
    wins.push(w);
  }
  // Wait for both to finish. Order doesn't matter — Chrome serializes
  // the dialogs anyway. The user just hits Save twice.
  await Promise.all(wins.map(awaitPopupDone));
}

/** @deprecated kept for callers that haven't switched to printToPdfPair. */
export async function printToPdfSequential(jobs: PrintJob[]): Promise<void> {
  // Sequential window.open calls lose user activation between them;
  // delegate the two-job case to the pair helper that opens both
  // synchronously. Anything longer is best-effort.
  if (jobs.length === 2) {
    await printToPdfPair([jobs[0], jobs[1]]);
    return;
  }
  for (const job of jobs) {
    await printToPdf(job);
  }
}
