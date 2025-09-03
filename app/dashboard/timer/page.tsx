"use client";

import { TimerController } from "@/components/controllers/timer-controller";

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

      <TimerController />
    </div>
  );
}
