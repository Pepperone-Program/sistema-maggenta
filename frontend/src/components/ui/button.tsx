import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva("inline-flex items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50", {
  variants: {
    variant: {
      default: "bg-primary text-white hover:bg-primary/90",
      outline: "border border-stroke bg-white text-dark hover:border-primary hover:text-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white",
      destructive: "bg-red-600 text-white hover:bg-red-700",
      ghost: "text-dark-4 hover:bg-gray-2 dark:text-dark-6 dark:hover:bg-dark-2",
    },
    size: { default: "h-9 px-3", sm: "h-8 px-2.5 text-xs", icon: "h-9 w-9" },
  },
  defaultVariants: { variant: "default", size: "default" },
});

export function Button({ className, variant, size, type = "button", ...props }: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
