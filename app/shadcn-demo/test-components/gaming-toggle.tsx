import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";
import * as React from "react";

export const StreamDeckToggle = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> & {
    label?: string;
    icon?: React.ReactNode;
    variant?: "default" | "danger" | "success";
  }
>(({ className, label, icon, variant = "default", ...props }, ref) => {
  const variants = {
    default: {
      active: "bg-gradient-to-br from-cyan-500 to-blue-600 shadow-cyan-500/50",
      inactive: "bg-slate-800 border-slate-600",
    },
    danger: {
      active: "bg-gradient-to-br from-red-500 to-red-600 shadow-red-500/50",
      inactive: "bg-slate-800 border-slate-600",
    },
    success: {
      active:
        "bg-gradient-to-br from-green-500 to-green-600 shadow-green-500/50",
      inactive: "bg-slate-800 border-slate-600",
    },
  };

  return (
    <div className="flex flex-col items-center space-y-2">
      <SwitchPrimitive.Root
        className={cn(
          "peer inline-flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center rounded-xl border-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
          "hover:scale-105 active:scale-95",
          props.checked
            ? `${variants[variant].active} shadow-lg border-transparent`
            : `${variants[variant].inactive} hover:border-slate-500`,
          className,
        )}
        {...props}
        ref={ref}
      >
        <div
          className={cn(
            "transition-all duration-200",
            props.checked ? "text-white scale-110" : "text-slate-400",
          )}
        >
          {icon}
        </div>
      </SwitchPrimitive.Root>
      {label && (
        <span className="text-xs font-medium text-slate-400 text-center max-w-16 leading-tight">
          {label}
        </span>
      )}
    </div>
  );
});
