import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Clean up spicerack logs older than a week, runs daily at midnight UTC
crons.daily(
  "cleanupOldSpicerackLogs",
  { hourUTC: 0, minuteUTC: 0 },
  internal.settings.cleanupOldSpicerackLogs,
);

export default crons;
