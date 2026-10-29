import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const THEMES = [
  {
    name: "light",
    Icon: Sun,
  },
  {
    name: "dark",
    Icon: Moon,
  },
];

export function ThemeToggleSwitch() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <button
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="group rounded-md bg-gray-3 p-1 text-[#111928] outline-1 outline-primary focus-visible:outline dark:bg-[#020D1A] dark:text-current"
    >
      <span className="sr-only">
        Switch to {theme === "light" ? "dark" : "light"} mode
      </span>

      <span aria-hidden className="relative flex gap-2.5">
        {/* Indicator */}
        <span className="absolute size-7 rounded-md border border-gray-200 bg-white transition-all dark:translate-x-[38px] dark:border-none dark:bg-dark-2 dark:group-hover:bg-dark-3" />

        {THEMES.map(({ name, Icon }) => (
          <span
            key={name}
            className={cn(
              "relative grid size-7 place-items-center rounded-md [&_svg]:size-4",
              name === "dark" && "dark:text-white",
            )}
          >
            <Icon />
          </span>
        ))}
      </span>
    </button>
  );
}
