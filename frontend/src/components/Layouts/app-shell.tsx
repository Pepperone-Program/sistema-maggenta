"use client";

import { usePathname } from "next/navigation";
import type { PropsWithChildren } from "react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <main className="min-h-screen bg-gray-2 dark:bg-[#020d1a]">{children}</main>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <div className="min-w-0 flex-1 bg-gray-2 dark:bg-[#020d1a]">
        <Header />

        <main className="isolate w-full overflow-hidden p-3 md:p-4">
          {children}
        </main>
      </div>
    </div>
  );
}
