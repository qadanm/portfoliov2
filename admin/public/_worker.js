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
    return env.ASSETS.fetch(request);
  },
};
