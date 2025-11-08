"use client";

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
} from "@/components/ui/field";
import { useAuthActions } from "@convex-dev/auth/react";
import Link from "next/link";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export default function ResetPassword() {
  const { signIn } = useAuthActions();
  const [step, setStep] = useState<"request" | { email: string }>("request");
  const [error, setError] = useState<string | null>(null);

  return step === "request" ? (
    <div className="flex flex-col gap-6">
      <Card className="corner-brackets-cross">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Reset your password</CardTitle>
          <CardDescription>
            Enter your email address and we&apos;ll send you a link to reset
            your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
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
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" type="email" name="email" required />
              </Field>
              <input name="flow" type="hidden" value="reset" />
              <Button type="submit">Send reset link</Button>
              <Link href="/login">
                <Button variant="outline" type="button">
                  Back to sign in
                </Button>
              </Link>
              {error && (
                <FieldDescription className="text-red-500">
                  {error}
                </FieldDescription>
              )}
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  ) : (
    <div className="flex flex-col gap-6">
      <Card className="corner-brackets-cross">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Check your email</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center">
            We sent a password reset link to <strong>{step.email}</strong>
          </p>
          <p className="text-sm text-muted-foreground text-center">
            Click the link in the email to set a new password.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
