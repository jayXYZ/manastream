import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Clean up integration logs, runs daily at midnight UTC
crons.daily(
  "cleanupOldIntegrationLogs",
  { hourUTC: 0, minuteUTC: 0 },
  internal.settings.cleanupOldIntegrationLogs,
);

export default crons;
