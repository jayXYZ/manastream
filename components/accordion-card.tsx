import React from "react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface AccordionCardProps {
  title: React.ReactNode;
  children: React.ReactNode;
  value?: string;
  defaultOpen?: boolean;
  connectedLifeTrackers?: number;
}

export function AccordionCard({
  title,
  children,
  value = "item-1",
  defaultOpen = false,
  connectedLifeTrackers,
}: AccordionCardProps) {
  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={defaultOpen ? value : undefined}
    >
      <AccordionItem value={value}>
        <Card>
          <CardHeader>
            <AccordionTrigger>
              <CardTitle>
                <div className="flex flex-row items-center gap-2">
                  {connectedLifeTrackers !== undefined && (
                    <span
                      className={`size-3 rounded-full border-2 ${
                        connectedLifeTrackers === 1
                          ? "bg-green-500"
                          : connectedLifeTrackers > 1
                            ? "bg-yellow-500"
                            : "bg-red-500"
                      }`}
                    />
                  )}
                  {title} - {connectedLifeTrackers}
                </div>
              </CardTitle>
            </AccordionTrigger>
          </CardHeader>
          <AccordionContent>
            <CardContent>{children}</CardContent>
          </AccordionContent>
        </Card>
      </AccordionItem>
    </Accordion>
  );
}
