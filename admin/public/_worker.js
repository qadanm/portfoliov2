// Cloudflare Pages advanced mode. The custom domain is protected by Access;
// send every Pages-provided hostname through that gate before serving assets.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === 'qadan-admin.pages.dev' || url.hostname.endsWith('.qadan-admin.pages.dev')) {
      url.protocol = 'https:';
      url.hostname = 'admin.qadan.co';
      url.port = '';
      return Response.redirect(url.toString(), 307);
    }
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set('X-Frame-Options', 'DENY');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('Permissions-Policy', 'interest-cohort=()');
    headers.set('X-Robots-Tag', 'noindex, nofollow');
    if (url.pathname === '/' || url.pathname.endsWith('/') || /\.(?:html|css|js|json|webmanifest)$/.test(url.pathname)) {
      headers.set('Cache-Control', 'private, no-store');
    }
    return new Response(response.body, {status: response.status, statusText: response.statusText, headers});
  },
};
