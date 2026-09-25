import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Clean up integration logs, runs daily at midnight UTC
crons.daily(
  "cleanupOldIntegrationLogs",
  { hourUTC: 0, minuteUTC: 0 },
  internal.settings.cleanupOldIntegrationLogs,
);

// Remove life-tracker presence rows whose heartbeat stopped (closed tabs
// whose unload handler never fired). Runs at the timeout interval.
crons.interval(
  "cleanUpLifeTrackers",
  { minutes: 5 },
  internal.presence.cleanUpLifeTrackers,
  {},
);

export default crons;
