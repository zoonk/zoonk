import { Avatar, AvatarFallback, AvatarImage } from "@zoonk/ui/components/avatar";

type Person = { image?: string | null; name?: string | null };

const INITIALS = 2;

/** "Ana Souza" is "AS"; a person with no name is "?". */
function initialsOf(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/u).filter(Boolean);

  const letters = [words.at(0), words.length > 1 ? words.at(-1) : undefined]
    .map((word) => word?.at(0) ?? "")
    .join("");

  return letters.slice(0, INITIALS).toUpperCase() || "?";
}

/** A person's mark wherever they're listed or named: their photo, or their initials. */
export function AdminUserAvatar({
  className,
  size = "sm",
  user,
}: {
  className?: string;
  size?: "default" | "sm";
  user: Person | null | undefined;
}) {
  return (
    <Avatar aria-hidden="true" className={className} size={size}>
      {user?.image ? <AvatarImage alt="" src={user.image} /> : null}
      <AvatarFallback className="text-2xs font-medium group-data-[size=default]/avatar:text-xs">
        {initialsOf(user?.name)}
      </AvatarFallback>
    </Avatar>
  );
}
