// Shared by the tools home and each installed Home Screen tool.
export function startUpdateChecks(beforeReload = async () => true) {
  const current = document.querySelector('meta[name="qadan-build-version"]')?.content;
  if (!/^[a-f0-9]{40}$/i.test(current || '')) return () => {};

  let checking = false, navigating = false, lastCheck = 0;
  async function check(force = false) {
    if (checking || navigating || document.visibilityState === 'hidden' || navigator.onLine === false) return;
    if (!force && Date.now() - lastCheck < 15000) return;
    checking = true;
    lastCheck = Date.now();
    try {
      const response = await fetch(`/version.json?current=${current.slice(0, 12)}`, {
        cache: 'no-store', credentials: 'same-origin',
      });
      if (!response.ok) return;
      const {version} = await response.json();
      if (!/^[a-f0-9]{40}$/i.test(version || '') || version === current) return;
      const url = new URL(location.href);
      const next = version.slice(0, 12);
      if (url.searchParams.get('build') === next) return; // Avoid a reload loop during edge propagation.
      if (await beforeReload(version) === false) return;
      navigating = true;
      url.searchParams.set('build', next); // A fresh URL defeats any old iOS page cache.
      location.replace(url.toString());
    } catch (error) {
      // Offline, an expired Access session, or a transient network error: retry later.
    } finally {
      checking = false;
    }
  }

  const onVisible = () => { if (document.visibilityState === 'visible') void check(true); };
  const onPageShow = () => void check();
  const onOnline = () => void check(true);
  let idleTimer = 0;
  const onFocusOut = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => void check(true), 1000);
  };
  document.addEventListener('visibilitychange', onVisible);
  document.addEventListener('focusout', onFocusOut);
  window.addEventListener('pageshow', onPageShow);
  window.addEventListener('online', onOnline);
  const timer = setInterval(() => void check(), 5 * 60 * 1000);
  void check();
  return () => {
    clearInterval(timer);
    clearTimeout(idleTimer);
    document.removeEventListener('visibilitychange', onVisible);
    document.removeEventListener('focusout', onFocusOut);
    window.removeEventListener('pageshow', onPageShow);
    window.removeEventListener('online', onOnline);
  };
}
