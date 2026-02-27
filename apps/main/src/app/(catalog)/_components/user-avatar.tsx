import { getSession } from "@zoonk/core/users/session/get";
import { Avatar, AvatarFallback, AvatarImage } from "@zoonk/ui/components/avatar";
import { User } from "lucide-react";

export async function UserAvatar() {
  const session = await getSession();
  const userAvatar = session?.user.image || undefined;
  const userName = session?.user.name || session?.user.email;
  const fallback = userName?.[0] || <User size={16} />;

  return (
    <Avatar className="focus-visible:ring-ring cursor-pointer focus-visible:ring-2 focus-visible:ring-offset-2">
      <AvatarImage src={userAvatar} />
      <AvatarFallback>{fallback}</AvatarFallback>
    </Avatar>
  );
}
