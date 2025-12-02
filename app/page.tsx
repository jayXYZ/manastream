"use client";

import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowRightIcon, BookIcon } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <LandingPageHeader />
      <main className="h-full overflow-auto">
        <Content />
      </main>
    </div>
  );
}

function SignInOutButton() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const router = useRouter();
  return (
    <>
      {isAuthenticated && (
        <Button
          onClick={() =>
            void signOut().then(() => {
              router.push("/login");
            })
          }
        >
          Sign out
        </Button>
      )}
      {!isAuthenticated && (
        <Button onClick={() => router.push("/login")}>Sign in</Button>
      )}
    </>
  );
}

function LandingPageHeader() {
  return (
    <header className="sticky top-0 z-10 bg-sidebar h-16 border-b-1 flex flex-row justify-between items-center p-4 w-full">
      <span>ManaStream</span>
      <SignInOutButton />
    </header>
  );
}

function Content() {
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();
  return (
    <div className="relative h-full">
      <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none select-none">
        <div className="font-extrabold text-[500px]">BETA</div>
      </div>
      <div className="relative z-10 flex flex-col h-full items-center justify-center gap-8">
        <div className="flex flex-col items-center justify-center gap-2">
          <h1 className="text-2xl font-bold">Welcome to ManaStream!</h1>

          <p className="text-sm text-muted-foreground">
            ManaStream is a tool for creating and managing your own TCG
            overlays.
          </p>
        </div>
        <div className="flex flex-col gap-8">
          {isAuthenticated && (
            <div className="flex flex-col gap-8">
              <div className="flex flex-row gap-8">
                <Button onClick={() => router.push("/dashboard")}>
                  Go to dashboard <ArrowRightIcon className="h-4 w-4" />
                </Button>
                <Button onClick={() => router.push("/lifetracker")}>
                  Go to lifetracker <ArrowRightIcon className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-row justify-center gap-8">
                <Link href="https://docs.manastream.app/docs" target="_blank">
                  <Button variant="secondary">
                    <BookIcon className="h-4 w-4" />
                    Read the docs
                  </Button>
                </Link>
              </div>
            </div>
          )}
          {!isAuthenticated && (
            <div className="flex flex-row gap-8">
              <Button onClick={() => router.push("/login")}>
                Get started <ArrowRightIcon className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
