import { cn } from "@/lib/utils";
import * as React from "react";

interface NeumorphicCardProps extends React.HTMLAttributes<HTMLDivElement> {
  pressed?: boolean;
  variant?: "raised" | "inset" | "flat";
}

export const NeumorphicCard = React.forwardRef<
  HTMLDivElement,
  NeumorphicCardProps
>(
  (
    { className, pressed = false, variant = "raised", children, ...props },
    ref,
  ) => {
    const variants = {
      raised: pressed
        ? "shadow-neumorphic-inset"
        : "shadow-neumorphic-raised hover:shadow-neumorphic-raised-hover",
      inset: "shadow-neumorphic-inset",
      flat: "shadow-neumorphic-flat hover:shadow-neumorphic-raised",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "bg-slate-900 rounded-2xl transition-all duration-200 border border-slate-800/50",
          variants[variant],
          pressed && "transform scale-[0.98]",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);

// Add these to your globals.css
