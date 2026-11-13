import { Buddy, type BuddyProps } from "@zoonk/ui/components/buddy";

export function Zu({ className, view }: Pick<BuddyProps, "className" | "view">) {
  return (
    <Buddy
      beltColor="white"
      className={className}
      energy={null}
      glasses="round"
      kind="zu"
      view={view}
    />
  );
}
