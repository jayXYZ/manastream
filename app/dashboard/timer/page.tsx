"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TimerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Timer
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mt-2">
          Manage round timers for your tournament
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tournament Timer</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 dark:text-gray-300">
            Timer controls coming soon...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
