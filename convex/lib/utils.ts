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
