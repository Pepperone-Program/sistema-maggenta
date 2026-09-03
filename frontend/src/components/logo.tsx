import darkLogo from "@/assets/logos/dark.svg";
import logo from "@/assets/logos/LOGO_MAGGENTA_v2.svg";
import Image from "next/image";

export function Logo() {
  return (
    <div className="relative h-25 max-w-[18.847rem] mb-6 min-[850px]:mb-10">
      <Image
        src={logo}
        className="dark:hidden"
        alt="NextAdmin logo"
        role="presentation"
        quality={100}
      />

      <Image
        src={logo}
        fill
        className="hidden dark:block"
        alt="NextAdmin logo"
        role="presentation"
        quality={100}
      />
    </div>
  );
}
