"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Monitor, Trophy, Timer, Settings } from "lucide-react";

export default function Dashboard() {
  const { isAuthenticated } = useConvexAuth();
  const tournament = useQuery(api.tournaments.getUserTournament);
  const createTournament = useMutation(api.tournaments.createTournament);
  const overlays = useQuery(api.overlays.getUserOverlays);

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">
            Authentication Required
          </h2>
          <p className="text-gray-600">
            Please sign in to access the dashboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mt-2">
          Manage your tournament overlays and controls
        </p>
      </div>

      {/* Tournament Setup */}
      <Card>
        <CardHeader>
          <CardTitle>Tournament Setup</CardTitle>
        </CardHeader>
        <CardContent>
          {!tournament ? (
            <div className="text-center py-6">
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Create a tournament to get started with overlays
              </p>
              <Button
                onClick={() => {
                  void createTournament({});
                }}
              >
                Create Tournament
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Tournament Active</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Created:{" "}
                    {new Date(tournament.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Current Round
                  </p>
                  <p className="text-2xl font-bold">
                    {tournament.currentRound}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      {tournament && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Monitor className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Total Overlays
                  </p>
                  <p className="text-2xl font-bold">{overlays?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Trophy className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Match Overlays
                  </p>
                  <p className="text-2xl font-bold">
                    {overlays?.filter((o) => o.type === "match").length || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Timer className="h-8 w-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Active Timers
                  </p>
                  <p className="text-2xl font-bold">0</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Settings className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    API Status
                  </p>
                  <p className="text-sm font-medium text-gray-500">Manual</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      {tournament && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button className="h-20 flex-col space-y-2">
                <Monitor className="h-6 w-6" />
                <span>New Match Overlay</span>
              </Button>
              <Button variant="outline" className="h-20 flex-col space-y-2">
                <Trophy className="h-6 w-6" />
                <span>View Controllers</span>
              </Button>
              <Button variant="outline" className="h-20 flex-col space-y-2">
                <Timer className="h-6 w-6" />
                <span>Start Timer</span>
              </Button>
              <Button variant="outline" className="h-20 flex-col space-y-2">
                <Settings className="h-6 w-6" />
                <span>Settings</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
