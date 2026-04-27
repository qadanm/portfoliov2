// Cloudflare Pages Function — admin-data sync endpoint.
//
// GET  /api/sync  → returns the latest blob the server has, or 204 if empty.
// PUT  /api/sync  → writes the body verbatim. Server is dumb storage; the
//                   client does the merge.
//
// Auth: gated by the same Cloudflare Access policy as the rest of /admin,
// so the function is only reachable by Moe. No extra auth here.
//
// Storage: a single KV key in the bound `KV` namespace. Single-user, so
// there's no per-user keyspace; collisions can't happen.

type PagesFunction<Env = unknown> = (ctx: {
  request: Request;
  env: Env;
}) => Response | Promise<Response>;

interface Env {
  // Bound in admin/wrangler.toml AND/OR via the Cloudflare Pages dashboard:
  //   Settings → Functions → KV namespace bindings → Variable name "KV"
  KV?: KVNamespace;
}

interface KVNamespace {
  get(key: string, opts?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream' }): Promise<string | null>;
  put(key: string, value: string, opts?: { metadata?: Record<string, unknown> }): Promise<void>;
  delete(key: string): Promise<void>;
  getWithMetadata(key: string): Promise<{ value: string | null; metadata: Record<string, unknown> | null }>;
}

const KEY = 'admin-data-v1';
const MAX_BODY_BYTES = 8 * 1024 * 1024; // 8MB headroom; KV allows up to 25MB

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

function bindingError(): Response {
  return json({
    ok: false,
    error: 'kv-binding-missing',
    message:
      'No KV namespace is bound to this Pages project as `KV`. Create one in the Cloudflare dashboard (Workers & Pages → KV → Create namespace), then bind it in the Pages project (Settings → Functions → KV namespace bindings) with variable name `KV`.',
  }, 503);
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  if (!ctx.env.KV) return bindingError();
  try {
    const { value, metadata } = await ctx.env.KV.getWithMetadata(KEY);
    if (!value) {
      return json({ ok: true, empty: true, state: null, updatedAt: 0 });
    }
    const updatedAt = Number((metadata as { updatedAt?: number } | null)?.updatedAt ?? 0);
    let state: unknown = null;
    try {
      state = JSON.parse(value);
    } catch {
      // Corrupt entry — surface clearly so the client can re-push.
      return json({
        ok: false,
        error: 'corrupt-state',
        message: 'Stored state could not be parsed.',
      }, 500);
    }
    return json({ ok: true, empty: false, state, updatedAt });
  } catch (e: unknown) {
    return json({
      ok: false,
      error: 'kv-read-failed',
      message: (e as Error)?.message ?? 'KV read failed.',
    }, 502);
  }
};

export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  if (!ctx.env.KV) return bindingError();

  const ct = ctx.request.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {
    return json({ ok: false, error: 'bad-content-type', message: 'PUT body must be application/json.' }, 415);
  }

  const cl = Number(ctx.request.headers.get('content-length') ?? 0);
  if (cl > MAX_BODY_BYTES) {
    return json({ ok: false, error: 'too-large', message: `Body exceeds ${MAX_BODY_BYTES} bytes.` }, 413);
  }

  let raw: string;
  try {
    raw = await ctx.request.text();
  } catch {
    return json({ ok: false, error: 'read-failed', message: 'Could not read body.' }, 400);
  }
  if (raw.length === 0) {
    return json({ ok: false, error: 'empty-body', message: 'Body is empty.' }, 400);
  }
  if (raw.length > MAX_BODY_BYTES) {
    return json({ ok: false, error: 'too-large', message: `Body exceeds ${MAX_BODY_BYTES} bytes.` }, 413);
  }

  let parsed: { state?: unknown; updatedAt?: number };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: 'bad-json', message: 'Body is not valid JSON.' }, 400);
  }
  if (typeof parsed !== 'object' || parsed === null || !('state' in parsed)) {
    return json({ ok: false, error: 'bad-shape', message: 'Body must be { state, updatedAt }.' }, 400);
  }

  const updatedAt = Number(parsed.updatedAt ?? Date.now());
  const stateJson = JSON.stringify(parsed.state);

  try {
    await ctx.env.KV.put(KEY, stateJson, { metadata: { updatedAt } });
  } catch (e: unknown) {
    return json({
      ok: false,
      error: 'kv-write-failed',
      message: (e as Error)?.message ?? 'KV write failed.',
    }, 502);
  }

  return json({ ok: true, updatedAt });
};

// Optional: expose a delete for the "wipe cloud copy" admin action.
export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  if (!ctx.env.KV) return bindingError();
  try {
    await ctx.env.KV.delete(KEY);
  } catch (e: unknown) {
    return json({
      ok: false,
      error: 'kv-delete-failed',
      message: (e as Error)?.message ?? 'KV delete failed.',
    }, 502);
  }
  return json({ ok: true, deleted: true });
};
