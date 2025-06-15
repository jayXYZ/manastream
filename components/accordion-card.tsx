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
}

export function AccordionCard({
  title,
  children,
  value = "item-1",
  defaultOpen = false,
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
              <CardTitle>{title}</CardTitle>
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
