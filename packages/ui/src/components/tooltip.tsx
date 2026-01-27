import * as React from "react";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

import { cn } from "../lib/utils";

// Props interface for TooltipProvider to match Radix-style API
interface TooltipProviderProps {
  children: React.ReactNode;
  delayDuration?: number;
  skipDelayDuration?: number;
}

// Provider that stores delay config in context
const TooltipDelayContext = React.createContext<{ delay: number }>({
  delay: 0,
});

const TooltipProvider = ({
  children,
  delayDuration = 0,
}: TooltipProviderProps) => {
  const value = React.useMemo(
    () => ({ delay: delayDuration }),
    [delayDuration],
  );
  return (
    <TooltipPrimitive.Provider>
      <TooltipDelayContext.Provider value={value}>
        {children}
      </TooltipDelayContext.Provider>
    </TooltipPrimitive.Provider>
  );
};

// Tooltip root
const Tooltip = ({
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Root>) => {
  return <TooltipPrimitive.Root {...props}>{children}</TooltipPrimitive.Root>;
};

// Wrapper to support Radix-style `asChild` prop, applying delay from context
const TooltipTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Trigger> & {
    asChild?: boolean;
  }
>(({ asChild, children, ...props }, ref) => {
  const { delay } = React.useContext(TooltipDelayContext);
  if (asChild && React.isValidElement(children)) {
    return (
      <TooltipPrimitive.Trigger
        ref={ref}
        render={children}
        delay={delay}
        {...props}
      />
    );
  }
  return (
    <TooltipPrimitive.Trigger ref={ref} delay={delay} {...props}>
      {children}
    </TooltipPrimitive.Trigger>
  );
});
TooltipTrigger.displayName = "TooltipTrigger";

const TooltipContent = React.forwardRef<
  React.ComponentRef<typeof TooltipPrimitive.Popup>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Popup> & {
    sideOffset?: number;
  }
>(({ className, sideOffset = 4, children, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Positioner sideOffset={sideOffset}>
      <TooltipPrimitive.Popup
        ref={ref}
        className={cn(
          "z-50 overflow-hidden rounded-md bg-foreground px-3 py-1.5 text-xs text-background animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          className,
        )}
        {...props}
      >
        {children}
      </TooltipPrimitive.Popup>
    </TooltipPrimitive.Positioner>
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = "TooltipContent";

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
export type { TooltipProviderProps };
