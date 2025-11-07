// Utility function for filtering undefined values from objects
export function filterUndefined<T extends Record<string, any>>(
  obj: T,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== undefined),
  ) as Partial<T>;
}

// Utility function for generating short UUIDs (12 characters)
export function generatePublicUuid(): string {
  // Generate a 12-character URL-safe ID
  // Uses base36 (0-9, a-z) for URL friendliness
  return (
    Math.random().toString(36).substring(2, 8) +
    Math.random().toString(36).substring(2, 8)
  );
}

// Utility function for retrying a function with exponential backoff
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: {
    retries?: number;
    delayMs?: number;
    backoffFactor?: number;
  },
): Promise<T> {
  const { retries = 3, delayMs = 500, backoffFactor = 2 } = options ?? {};

  let attempt = 0;

  while (attempt < retries) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt >= retries) {
        console.error(`❌ API call failed after ${retries} retries`);
        throw err;
      }

      const currentDelay = delayMs * Math.pow(backoffFactor, attempt - 1);
      console.warn(
        `⚠️ Attempt ${attempt} failed — retrying in ${currentDelay}ms`,
      );

      await new Promise((res) => setTimeout(res, currentDelay));
    }
  }

  // This point should be unreachable
  throw new Error("Unexpected retry loop state");
}
