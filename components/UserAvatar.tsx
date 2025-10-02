"use client";

import { User } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  AvatarSkeleton,
} from "./ui/avatar";

export function UserAvatar() {
  const { isPending, data: session } = authClient.useSession();

  if (isPending) {
    return <AvatarSkeleton />;
  }

  const userAvatar = session?.user.image || undefined;
  const userName = session?.user.name || session?.user.email;
  const fallback = userName?.[0] || <User size={16} />;

  return (
    <Avatar className="cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
      <AvatarImage src={userAvatar} />
      <AvatarFallback>{fallback}</AvatarFallback>
    </Avatar>
  );
}
