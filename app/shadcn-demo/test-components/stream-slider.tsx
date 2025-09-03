import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";
import * as React from "react";

export const StreamSlider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
    label?: string;
    showValue?: boolean;
  }
>(({ className, label, showValue = true, ...props }, ref) => (
  <div className="space-y-2">
    {label && (
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium text-cyan-400 uppercase tracking-wide">
          {label}
        </label>
        {showValue && (
          <span className="text-xs font-mono bg-slate-800 px-2 py-1 rounded border border-slate-700">
            {props.value?.[0] || 0}%
          </span>
        )}
      </div>
    )}
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex w-full touch-none select-none items-center group",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-3 w-full grow overflow-hidden rounded-full bg-slate-800 border border-slate-700">
        <SliderPrimitive.Range className="absolute h-full bg-gradient-to-r from-cyan-500 to-blue-500 shadow-lg shadow-cyan-500/25 transition-all duration-200" />
        {/* Volume level indicators */}
        <div className="absolute inset-0 flex items-center justify-between px-1">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-0.5 h-1.5 bg-slate-600 rounded-full transition-colors",
                (props.value?.[0] || 0) > i * 10 && "bg-white/60",
              )}
            />
          ))}
        </div>
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-cyan-400 bg-slate-900 shadow-lg shadow-cyan-400/25 ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:scale-110 hover:shadow-cyan-400/40" />
    </SliderPrimitive.Root>
  </div>
));
