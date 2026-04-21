export const THEME_KEY = 'mq-theme';

export const themeScript = `
(function() {
  const stored = localStorage.getItem('${THEME_KEY}');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = stored || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
})();
`;
