"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

export default function CopyButton({
  displayText,
  textToCopy,
}: {
  displayText: string;
  textToCopy: string;
}) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const handleCopy = async () => {
    if (copied) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setOpen(true); // Keep tooltip open
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-background border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 w-full">
      <p className="flex-1 min-w-0 text-sm text-muted-foreground truncate font-mono">
        {displayText}
      </p>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className={`shrink-0 h-6 w-6 p-0 transition-all duration-200 opacity-100`}
          >
            {copied ? (
              <Check className="size-3.5 text-green-500 opacity-100" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>{copied ? "Copied!" : "Copy to clipboard"}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
