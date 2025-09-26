import { getSession } from "@/lib/user";
import { LoginButton } from "./LoginButton";
import { UserAvatar } from "./UserAvatar";
import { UserDropdownMenu } from "./UserDropdownMenu";
import { DropdownMenu, DropdownMenuTrigger } from "./ui/dropdown-menu";

interface UserAvatarMenuProps {
  params: LayoutProps<"/[locale]">["params"];
}

export async function UserAvatarMenu({ params }: UserAvatarMenuProps) {
  const { locale } = await params;
  const session = await getSession();

  if (!session) {
    return <LoginButton locale={locale} />;
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
