"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mt-2">
          Configure your tournament and API settings
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tournament Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 dark:text-gray-300">
            Settings interface coming soon...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
