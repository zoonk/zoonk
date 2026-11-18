import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";

export function PlanLinkStartBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="contents max-sm:[--page-gutter:--spacing(4)] max-sm:[--page-safe-bottom:env(safe-area-inset-bottom)] max-sm:**:data-[slot=bottom-bar]:fixed max-sm:**:data-[slot=bottom-bar]:inset-x-0 max-sm:**:data-[slot=bottom-bar]:bottom-0 max-sm:**:data-[slot=bottom-bar]:m-0 sm:**:data-[slot=bottom-bar]:contents">
      <BottomBar className="sm:contents">
        <BottomBarActions className="sm:contents">{children}</BottomBarActions>
      </BottomBar>
    </div>
  );
}
