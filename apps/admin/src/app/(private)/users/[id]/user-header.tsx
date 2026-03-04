import { getUser } from "@/data/users/get-user";
import { Avatar, AvatarFallback, AvatarImage } from "@zoonk/ui/components/avatar";
import { Badge } from "@zoonk/ui/components/badge";
import { notFound } from "next/navigation";
import { BanUserDialog } from "./ban-user-dialog";
import { RevokeSessionsDialog } from "./revoke-sessions-dialog";
import { UnbanUserDialog } from "./unban-user-dialog";

export async function UserHeader({ userId }: { userId: number }) {
  const user = await getUser(userId);

  if (!user) {
    notFound();
  }

  const initials = (user.name || user.email)
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar size="lg">
            {user.image && <AvatarImage src={user.image} alt={user.name} />}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>

          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">{user.name || "—"}</h2>

            {user.username && (
              <span className="text-muted-foreground text-sm">@{user.username}</span>
            )}

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="capitalize">
                {user.role || "user"}
              </Badge>

              {user.emailVerified && <Badge variant="secondary">Verified</Badge>}
              {user.banned && <Badge variant="destructive">Banned</Badge>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <RevokeSessionsDialog userId={user.id} userName={user.name} />
          {user.banned ? (
            <UnbanUserDialog userId={user.id} userName={user.name} />
          ) : (
            <BanUserDialog userId={user.id} userName={user.name} />
          )}
        </div>
      </div>

      {user.banned && (user.banReason || user.banExpires) && (
        <div className="text-muted-foreground text-sm">
          {user.banReason && <p>Reason: {user.banReason}</p>}
          {user.banExpires && <p>Expires: {new Date(user.banExpires).toLocaleDateString()}</p>}
        </div>
      )}
    </div>
  );
}
