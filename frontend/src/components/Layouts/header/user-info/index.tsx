"use client";

import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { apiRequest } from "@/lib/api";
import {
  Dropdown,
  DropdownContent,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";


export function UserInfo() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<{ nome?: string; usuario?: string; email?: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    apiRequest<{ nome?: string; usuario?: string; email?: string }>("/api/v1/usuarios/profile", { signal: controller.signal }).then(setUser).catch(() => undefined);
    return () => controller.abort();
  }, []);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  const userName = user?.nome?.trim() || user?.usuario?.trim() || "Usuário";

  return (
    <Dropdown isOpen={isOpen} setIsOpen={setIsOpen}>
      <DropdownTrigger className="rounded align-middle outline-none ring-primary ring-offset-2 focus-visible:ring-1 dark:ring-offset-gray-dark">
        <span className="sr-only">Minha conta</span>

        <figure className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-gray-2 text-dark-4 dark:bg-dark-2"><UserRound className="size-4" aria-hidden="true" /></span>
          <figcaption className="flex items-center gap-1 font-medium text-dark dark:text-dark-6 max-[640px]:sr-only">
            <span>{userName}</span>

            <ChevronDown
              aria-hidden
              className={cn(
                "transition-transform",
                isOpen && "rotate-180",
              )}
              strokeWidth={1.5}
            />
          </figcaption>
        </figure>
      </DropdownTrigger>

      <DropdownContent
        className="border border-stroke bg-white shadow-md dark:border-dark-3 dark:bg-gray-dark min-[230px]:min-w-[17.5rem]"
        align="end"
      >
        <h2 className="sr-only">Informações do usuário</h2>

        <figure className="flex items-center gap-2.5 px-5 py-3.5">
          <span className="grid size-9 place-items-center rounded-full bg-gray-2 text-dark-4 dark:bg-dark-2"><UserRound className="size-4" aria-hidden="true" /></span>

          <figcaption className="space-y-1 text-sm font-medium">
            <div className="mb-2 leading-none text-dark dark:text-white">
              {userName}
            </div>

            <div className="leading-none text-gray-6">{user?.email || ""} </div>
          </figcaption>
        </figure>

        <hr className="border-[#E8E8E8] dark:border-dark-3" />

        <div className="p-2 text-base text-[#4B5563] dark:text-dark-6">
          <button
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[9px] hover:bg-gray-2 hover:text-dark dark:hover:bg-dark-3 dark:hover:text-white"
            onClick={() => {
              setIsOpen(false);
              handleLogout();
            }}
          >
            <LogOut className="size-4" />

            <span className="text-sm font-medium">Sair</span>
          </button>
        </div>
      </DropdownContent>
    </Dropdown>
  );
}
