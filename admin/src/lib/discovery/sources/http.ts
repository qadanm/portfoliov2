// Shared fetch-with-timeout for source adapters. One hung upstream must
// not stall the whole discovery run, so every source fetch goes through
// here: the request aborts after `ms` and surfaces as a normal per-source
// error (caught by the run orchestrator, recorded on the SourceConfig).

export async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 10_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Request timed out after ${Math.round(ms / 1000)}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
