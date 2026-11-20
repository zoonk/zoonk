import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";

/** The page's one main action, in the shared bottom bar; what it couldn't do shows over the bar. */
export function TodayBar({
  children,
  note,
}: {
  children: React.ReactNode;
  note?: React.ReactNode;
}) {
  return (
    <BottomBar note={note}>
      <BottomBarActions>{children}</BottomBarActions>
    </BottomBar>
  );
}
