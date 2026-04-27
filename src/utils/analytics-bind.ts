/**
 * Analytics binding — runs in the browser, hooks delegated listeners and
 * per-page lifecycle events to the Plausible queue.
 *
 * Bound exactly once per session (delegated listeners survive ViewTransitions
 * because they're attached to `document`). Per-page work — pageview firing,
 * scroll-depth reset, project_view — runs on every `astro:page-load`.
 */

import { track, type EventName } from './analytics';

let bound = false;
let scrollDepthCleanup: (() => void) | null = null;

export function initAnalytics(): void {
  if (typeof window === 'undefined') return;

  // Manual pageview — Plausible's manual.js does not auto-track, so we fire
  // it ourselves on every navigation. This is the right hook for Astro
  // ViewTransitions: by the time astro:page-load runs, document.title and
  // location.pathname both reflect the new page.
  if (typeof window.plausible === 'function') {
    window.plausible('pageview');
  }

  // Auto: project_view fires when a case-study URL is shown.
  const slug = location.pathname.match(/^\/build\/([^/]+)\/?$/)?.[1];
  if (slug) {
    track('project_view', { project: slug });
  }

  // Reset and re-bind scroll-depth tracking per page (each page has its own
  // total height and milestones should fire fresh on each visit).
  if (scrollDepthCleanup) scrollDepthCleanup();
  scrollDepthCleanup = bindScrollDepth();

  if (bound) return;
  bound = true;
  bindGlobalListeners();
}

/**
 * Single delegated click listener powers every `data-track="event"` element.
 * Any `data-track-{key}="value"` attribute on the same element becomes a
 * Plausible prop — this is the only API authoring code uses.
 *
 *   <a data-track="cta_click" data-track-cta="see-the-work" data-track-loc="hero">
 */
function bindGlobalListeners(): void {
  document.addEventListener('click', (e) => {
    const target = (e.target as Element | null)?.closest('[data-track]');
    if (!target) return;

    const event = target.getAttribute('data-track') as EventName | null;
    if (!event) return;

    const props: Record<string, string> = {};
    for (const attr of Array.from(target.attributes)) {
      if (attr.name.startsWith('data-track-') && attr.name !== 'data-track') {
        props[attr.name.slice('data-track-'.length)] = attr.value;
      }
    }
    track(event, props);
  });
}

function bindScrollDepth(): () => void {
  const milestones = [25, 50, 75, 100] as const;
  const fired = new Set<number>();
  let raf = 0;

  const onScroll = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      // Skip pages that aren't tall enough to scroll meaningfully — depth
      // metrics on a short About page would be noise, not signal.
      if (total < 600) return;
      const pct = Math.min(100, Math.round((window.scrollY / total) * 100));
      for (const m of milestones) {
        if (pct >= m && !fired.has(m)) {
          fired.add(m);
          track('scroll_depth', { depth: m, page: location.pathname });
        }
      }
    });
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  // Fire once in case the page loads already scrolled (anchor link / restore).
  onScroll();

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('scroll', onScroll);
  };
}
