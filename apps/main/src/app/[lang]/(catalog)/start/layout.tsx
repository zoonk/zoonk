import { RelaunchNotice } from "@/components/waitlist/relaunch-notice";
import { IS_RELAUNCH_WAITLIST_ENABLED } from "@zoonk/utils/relaunch";

export default function StartLayout({ children }: LayoutProps<"/[lang]/start">) {
  return IS_RELAUNCH_WAITLIST_ENABLED ? <RelaunchNotice /> : children;
}
