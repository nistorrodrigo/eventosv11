// ── retry.js — Exponential backoff retry for async operations ─────

/**
 * Retries an async function with exponential backoff.
 * @param {Function} fn - Async function to retry
 * @param {Object} opts - Options
 * @param {number} opts.retries - Max retries (default: 3)
 * @param {number} opts.baseDelay - Base delay in ms (default: 500)
 * @param {Function} opts.onRetry - Callback on each retry (attempt, error)
 * @returns {Promise} - Result of fn()
 */
export async function withRetry(fn, { retries = 3, baseDelay = 500, onRetry } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 200;
        if (onRetry) onRetry(attempt + 1, err);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

/**
 * Wraps a Supabase query with retry logic.
 * Only retries on network errors, not on RLS/auth errors.
 */
export async function supabaseRetry(queryFn) {
  return withRetry(async () => {
    const result = await queryFn();
    if (result.error) {
      // Don't retry auth/RLS errors (4xx)
      if (result.error.code?.startsWith("4") || result.error.message?.includes("JWT")) {
        throw Object.assign(new Error(result.error.message), { noRetry: true });
      }
      throw new Error(result.error.message);
    }
    return result;
  }, {
    retries: 2,
    baseDelay: 800,
    onRetry: (attempt, err) => {
      if (err.noRetry) throw err; // Don't retry auth errors
      console.warn(`[Supabase] Retry ${attempt}: ${err.message}`);
    }
  });
}
