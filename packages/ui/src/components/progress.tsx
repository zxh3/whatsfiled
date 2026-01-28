import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import * as React from "react";

import { cn } from "../lib/utils";

interface ProgressProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>,
    "value"
  > {
  value?: number | null;
  className?: string;
  indicatorClassName?: string;
}

const Progress = React.forwardRef<
  React.ComponentRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, indicatorClassName, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    value={value ?? 0}
    className={cn("relative", className)}
    {...props}
  >
    <ProgressPrimitive.Track className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full bg-primary transition-all duration-300",
          indicatorClassName,
        )}
      />
    </ProgressPrimitive.Track>
  </ProgressPrimitive.Root>
));
Progress.displayName = "Progress";

export { Progress };
