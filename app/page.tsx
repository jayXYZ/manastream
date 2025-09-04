"use client";

import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";

export default function Home() {
  return (
    <>
      <header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        DxC Overlay
        <SignInOutButton />
      </header>
      <main className="p-8 flex flex-col gap-8">
        <h1 className="text-4xl font-bold text-center">
          You probably shouldn&apos;t be here.
        </h1>
        <Content />
      </main>
    </>
  );
}

function SignInOutButton() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const router = useRouter();
  return (
    <>
      {isAuthenticated && (
        <button
          className="bg-slate-200 dark:bg-slate-800 text-foreground rounded-md px-2 py-1"
          onClick={() =>
            void signOut().then(() => {
              router.push("/signin");
            })
          }
        >
          Sign out
        </button>
      )}
      {!isAuthenticated && (
        <button
          className="bg-slate-200 dark:bg-slate-800 text-foreground rounded-md px-2 py-1"
          onClick={() => router.push("/signin")}
        >
          Sign in
        </button>
      )}
    </>
  );
}

function Content() {
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();
  return (
    <div className="flex flex-col gap-8 max-w-lg mx-auto">
      sign in above to get started :)
      {isAuthenticated && (
        <div className="flex flex-col gap-2">
          <button
            className="bg-slate-200 dark:bg-slate-800 text-foreground rounded-md px-2 py-1"
            onClick={() => router.push("/dashboard")}
          >
            Go to dashboard
          </button>
          <button
            className="bg-slate-200 dark:bg-slate-800 text-foreground rounded-md px-2 py-1"
            onClick={() => router.push("/lifetracker")}
          >
            Go to lifetracker
          </button>
        </div>
      )}
    </div>
  );
}
