function getErrorStatus(err: unknown): number | null {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (typeof e["status"] === "number") return e["status"];
    if (typeof e["statusCode"] === "number") return e["statusCode"];
  }
  return null;
}

const RETRYABLE = new Set([429, 500, 502, 503]);

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  timeoutMs?: number
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      let result: Promise<T>;
      if (timeoutMs !== undefined) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        result = fn().finally(() => clearTimeout(timer));
        result = Promise.race([
          result,
          new Promise<never>((_, reject) =>
            controller.signal.addEventListener("abort", () =>
              reject(new Error(`Request timed out after ${timeoutMs}ms`))
            )
          ),
        ]);
      } else {
        result = fn();
      }
      return await result;
    } catch (err) {
      lastError = err;
      // Timeouts are not retried — the server state is unknown
      if (err instanceof Error && err.message.startsWith("Request timed out")) throw err;
      const status = getErrorStatus(err);
      if (status !== null && RETRYABLE.has(status)) {
        const delay = Math.min(500 * 2 ** (attempt - 1), 8000);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}
