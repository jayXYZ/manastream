"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Icon-only button for the corner of a `group` Card. It stays invisible until
 * the card is hovered or the button is focused, and stays visible while
 * `revealed` is true (for example while its tooltip is open) so it does not
 * flicker away under the pointer. A disabled button reveals at a lower opacity.
 */
export function CardActionButton({
  revealed = false,
  disabled,
  className,
  ...props
}: React.ComponentProps<"button"> & { revealed?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground rounded-xs transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        revealed
          ? disabled
            ? "opacity-30"
            : "opacity-70"
          : disabled
            ? "opacity-0 group-hover:opacity-30"
            : "opacity-0 group-hover:opacity-70 focus-visible:opacity-70",
        className,
      )}
      {...props}
    />
  );
}
