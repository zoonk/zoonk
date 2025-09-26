import { getSession } from "@/lib/user";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

export function UserAvatarSkeleton() {
  return (
    <div className="ml-1 size-9 shrink-0 animate-pulse rounded-full bg-muted" />
  );
}

export async function UserAvatar() {
  const session = await getSession();

  const userAvatar = session?.user.image || undefined;
  const userName = session?.user.name || session?.user.email || "Z";

  return (
    <Avatar className="ml-1 cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
      <AvatarImage src={userAvatar} />
      <AvatarFallback>{userName[0]}</AvatarFallback>
    </Avatar>
  );
}
