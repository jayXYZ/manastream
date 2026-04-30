import { describe, expect, it } from "vitest";

import {
  getPasswordAuthFlow,
  getPasswordAuthSuccessResult,
  shouldShowInlineAuthError,
} from "../login-form-flow";

describe("login form password auth flow", () => {
  it("uses Convex Auth signIn for login submissions", () => {
    expect(getPasswordAuthFlow("login")).toBe("signIn");
  });

  it("uses Convex Auth signUp for signup submissions", () => {
    expect(getPasswordAuthFlow("signup")).toBe("signUp");
  });

  it("redirects password logins after immediate sign in", () => {
    expect(
      getPasswordAuthSuccessResult({
        step: "login",
        signingIn: true,
        email: "player@example.com",
      }),
    ).toEqual({ type: "redirect", href: "/dashboard" });
  });

  it("keeps signup on the email verification step", () => {
    expect(
      getPasswordAuthSuccessResult({
        step: "signup",
        signingIn: false,
        email: "player@example.com",
      }),
    ).toEqual({ type: "verifyEmail", email: "player@example.com" });
  });

  it("renders auth errors in both login and signup modes", () => {
    expect(shouldShowInlineAuthError("login", "Invalid credentials")).toBe(
      true,
    );
    expect(shouldShowInlineAuthError("signup", "Email already in use")).toBe(
      true,
    );
  });
});
