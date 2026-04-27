/**
 * Analytics — type-safe wrapper around Plausible's `window.plausible`.
 *
 * Plausible is loaded in manual mode so we control when the pageview fires
 * (necessary for Astro ViewTransitions). The script stub queues calls made
 * before the script finishes loading, so `track()` is always safe to call.
 *
 * Event taxonomy is intentionally small. Add a new event here before wiring
 * it in markup so the union type stays the source of truth.
 */

export type EventName =
  | 'cta_click'
  | 'contact_click'
  | 'project_view'
  | 'scroll_depth'
  | 'theme_toggle'
  | 'nav_open'
  | 'form_submit_attempt'
  | 'form_submit_success'
  | 'form_submit_error';

type PlausibleProps = Record<string, string | number | boolean>;

declare global {
  interface Window {
    plausible?: ((event: string, options?: { props?: PlausibleProps; callback?: () => void }) => void) & {
      q?: unknown[];
    };
  }
}

export function track(event: EventName, props?: PlausibleProps): void {
  if (typeof window === 'undefined') return;
  if (typeof window.plausible !== 'function') return;
  window.plausible(event, props ? { props } : undefined);
}
