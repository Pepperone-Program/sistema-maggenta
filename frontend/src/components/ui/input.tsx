import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn("flex h-9 w-full min-w-0 rounded-md border border-stroke bg-white px-3 text-sm text-dark outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-50 dark:border-dark-3 dark:bg-dark-2 dark:text-white", className)} {...props} />;
}
