import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const authSource = readFileSync("convex/auth.ts", "utf8");

describe("password auth email links", () => {
  it("points email verification links at the routed login verification page", () => {
    expect(authSource).toContain("`${origin}/login/verify-email?");
  });

  it("points password reset links at the routed login reset confirmation page", () => {
    expect(authSource).toContain("`${origin}/login/reset-password/confirm?");
  });
});
