import darkLogo from "@/assets/logos/dark.svg";
import logo from "@/assets/logos/LOGO_MAGGENTA_v2.svg";
import Image from "next/image";

export function Logo() {
  return (
    <div className="relative h-16 max-w-[145px] mb-2">
      <Image
        src={logo}
        className="dark:hidden"
        alt="Maggenta"
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
