import { USAGE_NOTICE_SCRIPT } from "@/lib/usage-data/usage-notice-script";

export function UsageNoticeScript() {
  return (
    <script
      // oxlint-disable-next-line react/no-danger -- A fixed script that must run before the first paint.
      dangerouslySetInnerHTML={{ __html: USAGE_NOTICE_SCRIPT }}
    />
  );
}
