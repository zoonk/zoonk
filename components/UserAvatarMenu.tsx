import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSession } from "@/lib/user";
import { UserAvatar } from "./UserAvatar";
import { UserDropdownMenu } from "./UserDropdownMenu";
import { buttonVariants } from "./ui/button";
import { DropdownMenu, DropdownMenuTrigger } from "./ui/dropdown-menu";

interface UserAvatarMenuProps {
  params: LayoutProps<"/[locale]">["params"];
}

export async function UserAvatarMenu({ params }: UserAvatarMenuProps) {
  const { locale } = await params;
  const t = await getTranslations("Menu");
  const session = await getSession();

  if (!session) {
    return (
      <Link href="/login" className={buttonVariants()}>
        {t("login")}
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <UserAvatar />
      </DropdownMenuTrigger>

      <UserDropdownMenu locale={locale} />
    </DropdownMenu>
  );
}
