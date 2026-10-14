import { getSession } from "@zoonk/core/users/session";
import { Avatar, AvatarFallback, AvatarImage } from "@zoonk/ui/components/avatar";
import { User } from "lucide-react";

/**
 * The learner's photo or initial. A guest has no name of their own yet (auth calls them
 * "Anonymous"), so they get the plain person icon.
 */
export async function UserAvatar() {
  const session = await getSession();
  const isGuest = Boolean(session?.user.isAnonymous);
  const userAvatar = session?.user.image || undefined;
  const userName = isGuest ? undefined : session?.user.name || session?.user.email;
  const fallback = userName?.[0] || <User size={16} />;

  return (
    <Avatar className="focus-visible:ring-ring size-full cursor-pointer focus-visible:ring-2 focus-visible:ring-offset-2">
      <AvatarImage src={userAvatar} />
      <AvatarFallback>{fallback}</AvatarFallback>
    </Avatar>
  );
}
