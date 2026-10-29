"use client";

import { Dialog as Primitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComponentProps, PropsWithChildren } from "react";

export const Dialog = Primitive.Root;
export const DialogTitle = Primitive.Title;
export const DialogDescription = Primitive.Description;

export function DialogContent({ children, className, ...props }: PropsWithChildren<ComponentProps<typeof Primitive.Popup>>) {
  return <Primitive.Portal>
    <Primitive.Backdrop className="fixed inset-0 z-[9998] bg-black/50" />
    <Primitive.Viewport className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto p-4">
      <Primitive.Popup className={cn("relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-stroke bg-white p-5 text-dark shadow-2 outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white", className)} {...props}>
        {children}
        <Primitive.Close aria-label="Fechar" className="absolute right-4 top-4 rounded p-1 text-dark-4 hover:bg-gray-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary dark:hover:bg-dark-2"><X className="size-4" /></Primitive.Close>
      </Primitive.Popup>
    </Primitive.Viewport>
  </Primitive.Portal>;
}
