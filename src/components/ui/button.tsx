import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold tracking-[-0.01em] ring-offset-background transition-[transform,background-color,border-color,color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-primary hover:-translate-y-0.5 hover:bg-primary/92 hover:shadow-glow",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-border bg-card/70 text-foreground shadow-sm hover:-translate-y-0.5 hover:border-primary/25 hover:bg-card hover:text-primary hover:shadow-md",
        secondary: "border border-primary/10 bg-secondary text-secondary-foreground hover:bg-secondary/75",
        ghost: "text-foreground/75 hover:bg-muted hover:text-foreground",
        link: "h-auto rounded-none p-0 text-primary underline-offset-4 hover:underline",
        hero: "bg-gradient-hero text-primary-foreground shadow-primary hover:-translate-y-0.5 hover:shadow-glow",
        heroOutline: "border border-white/20 bg-white/[0.06] text-white backdrop-blur hover:bg-white/[0.11] hover:border-white/30",
        accent: "bg-accent text-accent-foreground shadow-md hover:-translate-y-0.5 hover:bg-accent/90 hover:shadow-glow",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 rounded-lg px-4 text-xs",
        lg: "h-12 rounded-xl px-7 text-sm md:text-base",
        xl: "h-14 rounded-2xl px-8 text-base md:px-9",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
