// Local-time date helpers for <input type="date"> round-trips.
//
// `new Date('YYYY-MM-DD')` parses as UTC midnight and
// `new Date(ts).toISOString().slice(0, 10)` formats in UTC — in any
// UTC-minus timezone both shift the calendar date by a day (follow-ups
// show a day early, applied dates drift forward on every edit). Every
// page that parses or formats a date input, or compares "is this date
// overdue", should go through these instead.

/** Parse an <input type="date"> value ("YYYY-MM-DD") as LOCAL midnight, epoch ms. */
export function parseDateInput(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1).getTime();
}

/** Format an epoch-ms timestamp as a local "YYYY-MM-DD" for <input type="date">. */
export function toDateInputValue(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Epoch ms of local midnight at the start of today. */
export function startOfTodayLocal(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * True when ts falls strictly before local midnight today — i.e. the date
 * is yesterday or earlier. A follow-up dated *today* is due, not overdue.
 */
export function isOverdue(ts?: number): boolean {
  return ts != null && ts < startOfTodayLocal();
}
