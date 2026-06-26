import darkLogo from "@/assets/logos/dark.svg";
import logo from "@/assets/logos/Logo-Vertical-Flat.svg";
import Image from "next/image";

export function Logo() {
  return (
    <div className="relative h-20 max-w-[18.847rem]">
      <Image
        src={logo}
        fill
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
