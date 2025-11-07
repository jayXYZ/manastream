"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { isAuthenticated } = useConvexAuth();
  const tournament = useQuery(api.tournaments.getUserTournament);
  const overlays = useQuery(api.overlays.getUserOverlays);
  return (
    <div className="flex flex-col h-full">
      <p>Welcome to the dashboard</p>
      <p>You are {isAuthenticated ? "authenticated" : "not authenticated"}</p>
      {tournament ? (
        <p>You have a tournament! Great job!</p>
      ) : (
        <p>You do not have a tournament, please create one to get started</p>
      )}
      {overlays && overlays.length > 0 ? (
        <p>
          You have created {overlays.length} overlays! I&apos;m so proud of you!
        </p>
      ) : (
        <p>You do not have any overlays. Honestly, I&apos;m disappointed.</p>
      )}
    </div>
  );
}
