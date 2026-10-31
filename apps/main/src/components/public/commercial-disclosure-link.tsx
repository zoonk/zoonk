import { Link } from "@/i18n/navigation";

/** Japan's statutory name for the page, which a buyer there looks for whatever the site's language. */
export const COMMERCIAL_DISCLOSURE_TITLE = "特定商取引法に基づく表記";

export function CommercialDisclosureLink({ className }: { className?: string }) {
  return (
    <Link className={className} href="/commercial-disclosure" hrefLang="ja" lang="ja">
      {COMMERCIAL_DISCLOSURE_TITLE}
    </Link>
  );
}
