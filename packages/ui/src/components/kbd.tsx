import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";

const kbdVariants = cva(
  "inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground shadow-sm",
  {
    variants: {
      size: {
        default: "h-5 min-w-5 px-1.5 text-[10px]",
        sm: "h-4 min-w-4 px-1 text-[9px]",
        lg: "h-6 min-w-6 px-2 text-xs",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

function Kbd({
  className,
  size = "default",
  render,
  ...props
}: useRender.ComponentProps<"kbd"> & VariantProps<typeof kbdVariants>) {
  return useRender({
    defaultTagName: "kbd",
    props: mergeProps<"kbd">(
      {
        className: cn(kbdVariants({ className, size })),
      },
      props,
    ),
    render,
    state: {
      slot: "kbd",
      size,
    },
  });
}

const kbdGroupVariants = cva("inline-flex items-center gap-1", {
  variants: {
    size: {
      default: "gap-1",
      sm: "gap-0.5",
      lg: "gap-1.5",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

function KbdGroup({
  className,
  size = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof kbdGroupVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(kbdGroupVariants({ className, size })),
      },
      props,
    ),
    render,
    state: {
      slot: "kbd-group",
      size,
    },
  });
}

export { Kbd, KbdGroup, kbdVariants, kbdGroupVariants };
