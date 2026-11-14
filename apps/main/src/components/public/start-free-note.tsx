import { getAppLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { getSentenceSpace } from "@zoonk/utils/locale";
import { getExtracted } from "next-intl/server";
import { NoAccountStartNote } from "./no-account-note";

/** A page's last way in also answers "and after the free start?" with the way to the prices. */
export async function StartFreeNote({ pricing = false }: { pricing?: boolean }) {
  const t = await getExtracted();
  const space = getSentenceSpace(await getAppLocale());

  return (
    <NoAccountStartNote>
      {t("Start free, no account needed.")}

      {pricing && (
        <>
          {space}
          <Link
            className="hover:text-foreground hit-area relative underline underline-offset-4"
            href="/pricing"
          >
            {t("See prices")}
          </Link>
        </>
      )}
    </NoAccountStartNote>
  );
}
