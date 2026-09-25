import { cn } from "@/lib/utils";

/**
 * Shown to a signed-in user who has no tournament yet. A password sign-up
 * has no tournament (or settings) until its email is verified, and
 * getUserTournament / getSettings return null, not undefined, for that state.
 * Consumers must keep `undefined` for "still loading" and render this for
 * `null`; a generic falsy check leaves the page on a spinner forever.
 */
export function AccountNotSetUp({
  description = "Verify your email to finish creating your tournament, then come back here.",
  className,
}: {
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("p-4", className)}>
      <div className="rounded-lg border border-dashed border-border p-8">
        <div className="max-w-xl">
          <h2 className="text-lg font-semibold">
            Your account is not set up yet
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}
