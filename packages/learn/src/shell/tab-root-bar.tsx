import { PageTopBar } from "@zoonk/ui/components/page-top";
import { cn } from "@zoonk/ui/lib/utils";
import { FRAME_COLUMN_CLASS, NO_WAY_BACK } from "./learn-shell";

function PhoneOnly({ children }: { children: React.ReactNode }) {
  return (
    <div className="contents lg:hidden" data-phone-only="">
      {children}
    </div>
  );
}

export function LearnTabRootBar({ start, end }: { start: React.ReactNode; end: React.ReactNode }) {
  return (
    <div
      className={cn(FRAME_COLUMN_CLASS, "signed-in:[--bar-start-min:min(100%,11rem)]")}
      data-slot="learn-frame-bar"
    >
      <PageTopBar
        className={NO_WAY_BACK.computer.bare}
        actions={<PhoneOnly>{end}</PhoneOnly>}
        back={<PhoneOnly>{start}</PhoneOnly>}
      />
    </div>
  );
}
