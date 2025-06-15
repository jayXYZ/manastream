"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";

export default function OverlaysPage() {
  const tournament = useQuery(api.tournaments.getUserTournament);
  const createMatchOverlay = useMutation(api.overlays.createMatchOverlay);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Overlays
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mt-2">
          Manage and configure your tournament overlays
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overlay Management</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 dark:text-gray-300">
            Overlay management interface coming soon...
          </p>
          {tournament && (
            <Button
              onClick={() => {
                createMatchOverlay({
                  tournamentId: tournament._id,
                  name: "Match 1",
                });
              }}
            >
              Create Match Overlay
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
