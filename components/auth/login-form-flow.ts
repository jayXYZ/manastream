export type PasswordAuthStep = "login" | "signup";

export type PasswordAuthSuccessResult =
  | { type: "redirect"; href: string }
  | { type: "verifyEmail"; email: string };

export function getPasswordAuthFlow(step: PasswordAuthStep) {
  return step === "login" ? "signIn" : "signUp";
}

export function getPasswordAuthSuccessResult({
  step,
  signingIn,
  email,
}: {
  step: PasswordAuthStep;
  signingIn: boolean;
  email: string;
}): PasswordAuthSuccessResult {
  if (step === "login" && signingIn) {
    return { type: "redirect", href: "/dashboard" };
  }

  return { type: "verifyEmail", email };
}

export function shouldShowInlineAuthError(
  _step: PasswordAuthStep,
  error: string | null,
) {
  return error !== null && error.length > 0;
}
