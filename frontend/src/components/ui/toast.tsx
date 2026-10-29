"use client";

import { Toast } from "@base-ui/react/toast";
import { useEffect } from "react";

export const toast = Toast.createToastManager();

export function FeedbackToast({ message, type = "error" }: { message: string; type?: "error" | "success" | "info" }) {
  useEffect(() => {
    if (!message) return;
    const description = message === "Invalid or expired token"
      ? "Sua sessão expirou. Entre novamente para continuar."
      : message;
    // A stable ID coalesces simultaneous failures from the same operation.
    toast.add({ id: `${type}:${description}`, description, type, timeout: type === "error" ? 8000 : 5000, priority: type === "error" ? "high" : "low" });
  }, [message, type]);
  return null;
}

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((item) => (
    <Toast.Root key={item.id} toast={item} className="pointer-events-auto relative rounded-lg border border-stroke bg-white p-4 text-dark shadow-lg data-[limited]:hidden dark:border-dark-3 dark:bg-gray-dark dark:text-white">
      <Toast.Content className="flex items-start gap-3">
        <span aria-hidden="true" className={item.type === "error" ? "font-bold text-red-600" : item.type === "success" ? "font-bold text-green-600" : "font-bold text-primary"}>{item.type === "error" ? "!" : item.type === "success" ? "✓" : "i"}</span>
        <div className="min-w-0 flex-1">
          <Toast.Title className="font-semibold" />
          <Toast.Description className="break-words text-sm" />
          {item.actionProps && <Toast.Action className="mt-2 text-sm font-semibold text-primary" />}
        </div>
        <Toast.Close aria-label="Fechar notificação" className="rounded px-2 text-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">×</Toast.Close>
      </Toast.Content>
    </Toast.Root>
  ));
}

export function Toaster() {
  return (
    <Toast.Provider toastManager={toast} limit={3}>
      <Toast.Portal>
        <Toast.Viewport aria-label="Notificações" className="pointer-events-none fixed right-4 top-4 z-[100000] flex w-[calc(100%_-_2rem)] max-w-sm flex-col gap-3 outline-none">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}
