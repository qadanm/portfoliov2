import { defineConfig } from 'astro/config';

// Two run modes:
//   1. Local: `npm run dev` binds to 127.0.0.1:4322. Not LAN-reachable.
//   2. Remote: `npm run build` produces /dist for Cloudflare Pages, served
//      from https://admin.qadan.co behind Cloudflare Access (real auth).
//
// In either mode, your job/recruiter/letter data lives in browser localStorage
// at the origin you opened — it never enters the deployed bundle.
export default defineConfig({
  output: 'static',
  site: 'https://admin.qadan.co',
  server: {
    host: '127.0.0.1',
    port: 4322,
  },
});
