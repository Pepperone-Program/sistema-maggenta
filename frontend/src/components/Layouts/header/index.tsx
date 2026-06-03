"use client";

import { SearchIcon } from "@/assets/icons";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { useClickOutside } from "@/hooks/use-click-outside";
import { NAV_DATA } from "../sidebar/data";
import { useSidebarContext } from "../sidebar/sidebar-context";
import { MenuIcon } from "./icons";
import { Notification } from "./notification";
import { ThemeToggleSwitch } from "./theme-toggle";
import { UserInfo } from "./user-info";

const SEARCH_ITEMS = NAV_DATA.flatMap((section) =>
  section.items.flatMap((item) => {
    const children = item.items.map((subItem) => ({
      title: subItem.title,
      url: subItem.url,
      section: section.label,
      parent: item.title,
      keywords: `${section.label} ${item.title} ${subItem.title}`,
    }));

    if (item.url) {
      return [
        {
          title: item.title,
          url: item.url,
          section: section.label,
          parent: "",
          keywords: `${section.label} ${item.title}`,
        },
        ...children,
      ];
    }

    return children;
  }),
);

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function Header() {
  const { toggleSidebar, isMobile } = useSidebarContext();
  const router = useRouter();
  const searchRef = useClickOutside<HTMLFormElement>(() =>
    setShowResults(false),
  );
  const [search, setSearch] = useState("");
  const [showResults, setShowResults] = useState(false);
  const results = useMemo(() => {
    const term = normalizeSearch(search.trim());

    if (!term) return [];

    return SEARCH_ITEMS.filter((item) =>
      normalizeSearch(item.keywords).includes(term),
    ).slice(0, 8);
  }, [search]);

  function navigateTo(url: string) {
    setSearch("");
    setShowResults(false);
    router.push(url);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (results[0]) {
      navigateTo(results[0].url);
    }
  }

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-stroke bg-white px-4 py-5 shadow-1 dark:border-stroke-dark dark:bg-gray-dark md:px-5 2xl:px-10">
      <button
        onClick={toggleSidebar}
        className="rounded-lg border px-1.5 py-1 dark:border-stroke-dark dark:bg-[#020D1A] hover:dark:bg-[#FFFFFF1A] lg:hidden"
      >
        <MenuIcon />
        <span className="sr-only">Toggle Sidebar</span>
      </button>

      {isMobile && (
        <Link href={"/"} className="ml-2 max-[430px]:hidden min-[375px]:ml-4">
          <Image
            src={"/images/logo/logo-icon.svg"}
            width={32}
            height={32}
            alt=""
            role="presentation"
          />
        </Link>
      )}

      <div className="max-xl:hidden">
        <h1 className="mb-0.5 text-heading-5 font-bold text-dark dark:text-white">
          Sistema Pepperone
        </h1>
        <p className="font-medium">Gestão do site da Pepperone Brindes</p>
      </div>

      <div className="flex flex-1 items-center justify-end gap-2 min-[375px]:gap-4">
        <form
          className="relative w-full max-w-[300px]"
          onSubmit={handleSubmit}
          ref={searchRef}
        >
          <input
            type="search"
            placeholder="Buscar no sistema"
            onChange={(event) => {
              setSearch(event.target.value);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
            value={search}
            className="flex w-full items-center gap-3.5 rounded-full border bg-gray-2 py-3 pl-[53px] pr-5 outline-none transition-colors focus-visible:border-primary dark:border-dark-3 dark:bg-dark-2 dark:hover:border-dark-4 dark:hover:bg-dark-3 dark:hover:text-dark-6 dark:focus-visible:border-primary"
          />

          <SearchIcon className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 max-[1015px]:size-5" />

          {showResults && search.trim() && (
            <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-full overflow-hidden rounded-lg border border-stroke bg-white shadow-2 dark:border-dark-3 dark:bg-gray-dark">
              {results.length ? (
                <ul className="max-h-80 overflow-y-auto py-1">
                  {results.map((item) => (
                    <li key={`${item.section}-${item.url}`}>
                      <button
                        className={cn(
                          "block w-full px-4 py-3 text-left text-sm transition-colors",
                          "hover:bg-gray-2 hover:text-primary dark:hover:bg-dark-2",
                        )}
                        onClick={() => navigateTo(item.url)}
                        type="button"
                      >
                        <span className="block font-semibold text-dark dark:text-white">
                          {item.title}
                        </span>
                        <span className="block text-xs text-dark-4 dark:text-dark-6">
                          {item.parent
                            ? `${item.section} / ${item.parent}`
                            : item.section}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-4 py-3 text-sm text-dark-4 dark:text-dark-6">
                  Nenhum item encontrado.
                </div>
              )}
            </div>
          )}
        </form>

        <ThemeToggleSwitch />

        <Notification />

        <div className="shrink-0">
          <UserInfo />
        </div>
      </div>
    </header>
  );
}
