"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function VerifyEmail() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const email = searchParams.get("email");
  const isInvalidLink = !token || !email;
  const invalidLinkError =
    "Invalid verification link. Please try signing in again.";
  const [verificationStatus, setVerificationStatus] = useState<
    "verifying" | "success" | "error"
  >("verifying");
  const [verificationError, setVerificationError] = useState<string | null>(
    null,
  );
  const status = isInvalidLink ? "error" : verificationStatus;
  const error = isInvalidLink ? invalidLinkError : verificationError;

  useEffect(() => {
    if (isInvalidLink) {
      return;
    }

    // Create FormData with the token and email
    const formData = new FormData();
    formData.append("code", token);
    formData.append("email", email);
    formData.append("flow", "email-verification");

    // Attempt to verify
    void signIn("password", formData)
      .then(() => {
        setVerificationStatus("success");
        setTimeout(() => {
          router.push("/dashboard");
        }, 1500);
      })
      .catch((err) => {
        setVerificationStatus("error");
        setVerificationError(
          err.message || "Verification failed. Please try again.",
        );
      });
  }, [email, isInvalidLink, router, signIn, token]);

  return (
    <div className="flex flex-col gap-8 w-96 mx-auto h-screen justify-center items-center">
      {status === "verifying" && (
        <>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground" />
          <p className="text-lg font-semibold">Verifying your email...</p>
          <p className="text-sm text-muted-foreground">
            Please wait while we confirm your email address.
          </p>
        </>
      )}

      {status === "success" && (
        <>
          <div className="text-green-500 text-6xl">✓</div>
          <p className="text-lg font-semibold">Email verified!</p>
          <p className="text-sm text-muted-foreground">
            Redirecting you to the dashboard...
          </p>
        </>
      )}

      {status === "error" && (
        <>
          <div className="text-red-500 text-6xl">✕</div>
          <p className="text-lg font-semibold">Verification failed</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => router.push("/login")}
            className="bg-foreground text-background rounded-md p-2 px-4"
          >
            Back to sign in
          </button>
        </>
      )}
    </div>
  );
}
