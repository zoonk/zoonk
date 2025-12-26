import { buttonVariants } from "@zoonk/ui/components/button";
import Link from "next/link";

export function LogoutButton() {
  return (
    <Link className={buttonVariants()} href="/logout" prefetch={false}>
      Logout
    </Link>
  );
}
