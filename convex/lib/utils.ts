// Utility function for filtering undefined values from objects
export function filterUndefined<T extends Record<string, any>>(
  obj: T,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== undefined),
  ) as Partial<T>;
}

// Utility function for generating cryptographically secure public UUIDs
// Uses 18 URL-safe characters (~107 bits of entropy) for access control
const URL_SAFE_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function generatePublicUuid(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  let result = "";
  for (let i = 0; i < bytes.length; i++) {
    result += URL_SAFE_ALPHABET[bytes[i] & 63]; // mask to 6 bits (0-63)
  }
  return result;
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
