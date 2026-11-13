import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import { Button, FORWARD_ICON } from "@zoonk/ui/components/button";
import { EnterButton } from "@zoonk/ui/components/enter-button";
import { BackLink, PageTitle, PageTop } from "@zoonk/ui/components/page-top";
import { ChevronRightIcon } from "lucide-react";

export function ActionsSpecimen() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <EnterButton enter="host">Continue session</EnterButton>
        <EnterButton busy enter="host">
          Continue session
        </EnterButton>
        <Button size="lg" variant="outline" {...FORWARD_ICON}>
          See the plan
        </Button>
        <Button size="lg" variant="ghost">
          Not now
        </Button>
      </div>
      <p className="text-muted-foreground text-sm">
        Already know this? <Button variant="link">Take the test</Button>
      </p>
    </div>
  );
}

export function PageTopSpecimen() {
  return (
    <div className="flex flex-col gap-6 [--page-gutter:--spacing(4)]">
      <div className="ring-border max-w-sm overflow-hidden rounded-lg px-(--page-gutter) pb-6 ring-1">
        <PageTop
          actions={
            <Button edge="end" size="sm" variant="ghost">
              See all
              <ChevronRightIcon aria-hidden="true" data-icon="inline-end" />
            </Button>
          }
          back={
            <BackLink aria-label="Back to Settings" href="#page-top">
              Settings
            </BackLink>
          }
        >
          <PageTitle>Profile</PageTitle>
        </PageTop>
      </div>
    </div>
  );
}

export function BottomBarSpecimen() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {[false, true].map((failed) => (
        <div
          className="ring-border flex h-48 flex-col overflow-hidden rounded-lg px-(--page-gutter) ring-1 [--page-gutter:--spacing(4)]"
          key={String(failed)}
        >
          <p className="text-muted-foreground flex-1 pt-4 text-sm">The screen scrolls here.</p>
          <BottomBar note={failed ? "We couldn't save that. Try again." : undefined}>
            <BottomBarActions>
              <Button size="xl" variant="outline">
                Skip
              </Button>
              <EnterButton enter="host" size="xl">
                Continue
              </EnterButton>
            </BottomBarActions>
          </BottomBar>
        </div>
      ))}
    </div>
  );
}
