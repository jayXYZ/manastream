import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Clean up integration logs, runs daily at midnight UTC
crons.daily(
  "cleanupOldIntegrationLogs",
  { hourUTC: 0, minuteUTC: 0 },
  internal.settings.cleanupOldIntegrationLogs,
);

// Clean up automation events, deliveries, and OBS commands older than a week
crons.daily(
  "cleanupOldAutomationHistory",
  { hourUTC: 0, minuteUTC: 15 },
  internal.automations.cleanupOldAutomationHistory,
);

export default crons;
