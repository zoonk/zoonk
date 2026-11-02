import Image from "next/image";
import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" aria-label="Zoonk Blog home">
      <Image src="/icon.svg" alt="Zoonk logo" width={32} height={32} className="rounded-lg" />
    </Link>
  );
}
