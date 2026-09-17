"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatRelativeTime, TRIGGER_LABELS } from "../automation-labels";

function statusColor(status: string): string {
  switch (status) {
    case "success":
      return "text-green-500";
    case "failed":
      return "text-red-500";
    default:
      return "text-yellow-500";
  }
}

export function DeliveriesCard() {
  const deliveries = useQuery(api.automations.listDeliveries, { limit: 50 });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Deliveries</CardTitle>
        <CardDescription>
          Every time an automation fires, one row appears here with the
          outcome. History is kept for seven days.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="sunken rounded-lg p-4 max-h-[360px] overflow-y-auto">
          {!deliveries || deliveries.length === 0 ? (
            <div className="text-sm text-white/40 font-mono">
              Nothing has fired yet.
            </div>
          ) : (
            <div className="flex flex-col gap-2 font-mono">
              {deliveries.map((delivery) => (
                <div
                  key={delivery._id}
                  className="flex flex-row gap-3 text-xs border-b border-white/10 pb-2 last:border-b-0"
                >
                  <div className="text-white/40 shrink-0 w-16">
                    {formatRelativeTime(delivery.createdAt)}
                  </div>
                  <div
                    className={`shrink-0 w-16 uppercase ${statusColor(delivery.status)}`}
                  >
                    {delivery.status}
                  </div>
                  <div className="text-white/50 shrink-0 w-40 truncate">
                    {delivery.automationName}
                    {delivery.isTest ? " (test)" : ""}
                  </div>
                  <div className="text-white/50 shrink-0 w-44 truncate">
                    {TRIGGER_LABELS[delivery.eventType]}
                  </div>
                  <div className="text-white/70 min-w-0 flex-1 truncate">
                    {delivery.actionType === "obs"
                      ? `OBS command ${delivery.obsCommandStatus ?? "queued"}`
                      : delivery.responseStatus !== undefined
                        ? `HTTP ${delivery.responseStatus}`
                        : "webhook"}
                    {delivery.attempts > 1 && ` · ${delivery.attempts} attempts`}
                    {delivery.lastError && ` · ${delivery.lastError}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
