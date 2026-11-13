import { ZoonkLogo } from "@zoonk/ui/components/zoonk-logo";
import Link from "next/link";

export function Logo() {
  return (
    <Link
      aria-label="Zoonk Blog home"
      className="focus-visible:ring-ring/50 -m-2.5 flex items-center rounded-xl p-2.5 outline-none focus-visible:ring-[3px]"
      href="/"
    >
      <ZoonkLogo className="size-6" />
    </Link>
  );
}
