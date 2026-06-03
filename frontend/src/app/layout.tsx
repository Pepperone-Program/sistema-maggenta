import "@/css/satoshi.css";
import "@/css/style.css";

import "flatpickr/dist/flatpickr.min.css";
import "jsvectormap/dist/jsvectormap.css";

import { AppShell } from "@/components/Layouts/app-shell";
import type { Metadata } from "next";
import NextTopLoader from "nextjs-toploader";
import type { PropsWithChildren } from "react";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: {
    template: "%s | Sistema Pepperone ",
    default: "Sistema Pepperone",
  },
  description: "Painel administrativo Pepperone conectado as APIs do sistema.",
  icons: {
    icon: "/images/favicon.ico",
  },
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <Providers>
          <NextTopLoader color="#b91c1c" showSpinner={false} />
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
