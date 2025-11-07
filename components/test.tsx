import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";

export function OpsPanel() {
  const [strokeWidth, setStrokeWidth] = useState(2);

  return (
    <Card
      className={cn(
        "bg-bg-panel border border-bg-border",
        "corner-brackets-cross",
      )}
    >
      <CardHeader className="text-accent-yellow text-xs uppercase tracking-wider border-b border-bg-border">
        Agent Data Overview
      </CardHeader>
      <CardContent className="text-text-dim text-xs">
        <div className="flex justify-between">
          <span>Status: lol</span>
          <span className="text-accent-green">Active</span>
        </div>
        <div className="flex justify-between">
          <svg
            width="10"
            height="10"
            className="transition-transform duration-500 hover:rotate-90 [&>line]:transition-[stroke-width] [&>line]:duration-200 hover:[&>line]:stroke-[2]"
          >
            <line
              x1="5"
              x2="5"
              y1="2"
              y2="8"
              stroke="white"
              strokeWidth="1"
              strokeLinecap="round"
            />
            <line
              x1="2"
              x2="8"
              y1="5"
              y2="5"
              stroke="white"
              strokeWidth="1"
              strokeLinecap="round"
            />
          </svg>
          <CyberButton />
        </div>
      </CardContent>
    </Card>
  );
}

interface CornerAccent {
  className?: string;
}

function CornerAccent({ className }: CornerAccent) {
  return (
    <div
      className={cn("pointer-events-none absolute h-1 w-1", className)}
      style={{
        background: `
          linear-gradient(#ff0000 0 0) center / 1px 5px,
          linear-gradient(#ff0000 0 0) center / 5px 1px
        `,
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}

interface CyberCardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  showCornerAccents?: boolean;
}

export function CyberCard({
  children,
  className,
  title,
  showCornerAccents = true,
}: CyberCardProps) {
  return (
    <div className={cn("relative border bg-black p-4", className)}>
      {showCornerAccents && (
        <>
          <CornerAccent className="-left-[2px] -top-[2px]" />
          <CornerAccent className="-right-[2px] -top-[2px]" />
          <CornerAccent className="-bottom-[2px] -left-[2px]" />
          <CornerAccent className="-bottom-[2px] -right-[2px]" />
        </>
      )}

      {title && (
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#00ff00]">
            {title}
          </h3>
        </div>
      )}
      {children}
    </div>
  );
}

export function CyberButton() {
  return (
    <Button className="relative group bg-bg-panel border border-bg-border transition-transform duration-500 hover:scale-105 hover:bg-bg-panel p-0 rounded-none">
      <CornerCross
        direction="cw"
        className="absolute top-[-8.5px] left-[-8.5px]"
      />
      <CornerCross
        direction="ccw"
        className="absolute bottom-[-8.5px] left-[-8.5px]"
      />
      <CornerCross
        direction="ccw"
        className="absolute top-[-8.5px] right-[-8.5px]"
      />
      <CornerCross
        direction="cw"
        className="absolute bottom-[-8.5px] right-[-8.5px]"
      />
    </Button>
  );
}

export function CornerCross({
  direction,
  className,
}: {
  direction: "cw" | "ccw";
  className?: string;
}) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      className={cn(
        "transition-transform duration-500 [&>line]:transition-[stroke-width] [&>line]:duration-200 group-hover:[&>line]:stroke-[2]",
        className,
        direction === "cw" ? "group-hover:rotate-90" : "group-hover:-rotate-90",
      )}
      style={{ transformOrigin: "center" }}
    >
      <line
        x1="5"
        x2="5"
        y1="2"
        y2="8"
        stroke="white"
        strokeWidth="0.5px"
        strokeLinecap="round"
      />
      <line
        x1="2"
        x2="8"
        y1="5"
        y2="5"
        stroke="white"
        strokeWidth="0.5px"
        strokeLinecap="round"
      />
    </svg>
  );
}
