"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import Link from "next/link";
import { GoogleLogo } from "./GoogleLogo";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { signIn } = useAuthActions();
  const [step, setStep] = useState<"login" | "signup" | { email: string }>(
    "login",
  );
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const validatePassword = (pass: string, confirm: string) => {
    if (step === "signup") {
      if (pass.length < 8) {
        setPasswordError("Password must be at least 8 characters");
        return false;
      }
      if (pass.length >= 8 && pass !== confirm) {
        setPasswordError("Passwords do not match");
        return false;
      }
      setPasswordError(null);
      return pass.length >= 8 && pass === confirm;
    }
    return true;
  };

  return step === "login" || step === "signup" ? (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="corner-brackets-cross rounded-none">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            {step === "login" ? "Welcome back" : "Create an account"}
          </CardTitle>
          <CardDescription>
            {step === "login"
              ? "Login with your Google account"
              : "Sign up with your Google account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();

              // Validate passwords for signup
              if (
                step === "signup" &&
                !validatePassword(password, confirmPassword)
              ) {
                return;
              }

              const formData = new FormData(e.currentTarget);
              void signIn("password", formData)
                .catch((error) => {
                  setError(error.message);
                })
                .then(() => {
                  setStep({ email: formData.get("email") as string });
                });
            }}
          >
            <FieldGroup>
              <Field>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => signIn("google")}
                >
                  <GoogleLogo colorful={true} />
                  Continue with Google
                </Button>
              </Field>
              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                Or
              </FieldSeparator>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" type="email" name="email" required />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  {step === "login" && (
                    <Link
                      href="/reset-password"
                      className="ml-auto text-sm underline-offset-4 hover:underline"
                    >
                      Forgot your password?
                    </Link>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </Field>
              {step === "signup" && (
                <Field>
                  <FieldLabel htmlFor="confirmPassword">
                    Confirm Password
                  </FieldLabel>
                  <Input
                    id="confirmPassword"
                    type="password"
                    name="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  {passwordError ||
                    (error && (
                      <FieldDescription className="text-red-500">
                        {passwordError || error}
                      </FieldDescription>
                    ))}
                </Field>
              )}
              <Field>
                <Button type="submit">
                  {step === "login" ? "Login" : "Sign up"}
                </Button>
                <FieldDescription className="text-center">
                  {step === "login"
                    ? "Don't have an account?"
                    : "Already have an account?"}{" "}
                  <span
                    className="text-muted-foreground underline cursor-pointer hover:text-foreground"
                    onClick={() => {
                      setStep(step === "login" ? "signup" : "login");
                      setPassword("");
                      setConfirmPassword("");
                      setPasswordError(null);
                      setError(null);
                    }}
                  >
                    {step === "login" ? "Sign up" : "Login"}
                  </span>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center text-sm font-mono">
        Fuck you.
      </FieldDescription>
    </div>
  ) : (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="corner-brackets-cross">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Check your email</CardTitle>
          <CardDescription>
            We sent a verification link to <strong>{step.email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Click the link in the email to verify your account.</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setStep("login");
              setError(null);
            }}
          >
            Back to login
          </Button>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center text-sm font-mono">
        Fuck you.
      </FieldDescription>
    </div>
  );
}
