import { Link } from "@/i18n/navigation";
import { getExtracted } from "next-intl/server";

export async function CommercialDisclosureLink({ className }: { className?: string }) {
  const t = await getExtracted();

  return (
    <Link className={className} href="/commercial-disclosure" hrefLang="ja">
      {t({
        description:
          "Link to the seller disclosure that Japan's Act on Specified Commercial Transactions requires; the page it opens is in Japanese. In Japanese it must read exactly “特定商取引法に基づく表記”. Elsewhere, name the page and say it's for Japan.",
        message: "Commercial disclosure (Japan)",
      })}
    </Link>
  );
}
