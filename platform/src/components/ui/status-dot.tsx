import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils";

const statusDotVariants = cva(
  "inline-block rounded-full",
  {
    variants: {
      variant: {
        active: "bg-primary shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_20%,transparent)]",
        idle: "bg-muted-foreground/40",
        muted: "bg-muted-foreground/25",
        destructive: "bg-destructive",
      },
      size: {
        sm: "size-1.5",
        default: "size-2",
        lg: "size-2.5",
      },
    },
    defaultVariants: {
      variant: "active",
      size: "default",
    },
  },
);

export interface StatusDotProps extends VariantProps<typeof statusDotVariants> {
  className?: string;
  label?: string;
}

export function StatusDot({ className, variant, size, label }: StatusDotProps) {
  return (
    <span
      className={cn(statusDotVariants({ variant, size }), className)}
      role={label ? "status" : undefined}
      aria-label={label}
    />
  );
}
