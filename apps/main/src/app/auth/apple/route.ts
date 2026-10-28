import { escapeHtml } from "@/lib/http/escape-html";
import { LOCALE_COOKIE } from "@zoonk/utils/locale";
import { getLocaleFromRequest } from "@zoonk/utils/locale-request";
import { getExtracted } from "next-intl/server";
import { type NextRequest } from "next/server";

/**
 * Nothing runs or loads here: the Apple code and identity token in the address's fragment stay in
 * this browser, and leaving the page sends no referrer. Inline styles can't read the address or
 * reach the network, so the page keeps its own few.
 */
const CONTENT_SECURITY_POLICY =
  "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'";

const STYLE =
  "body{font:1rem/1.5 system-ui,sans-serif;margin:0 auto;max-width:32rem;padding:2rem 1.5rem}h1{font-size:1.5rem;line-height:1.25}";

/**
 * Where Apple sign-in returns on Android, with its result in the fragment (the API's
 * `/auth/apple/android` redirects here). The app opens this App Link before it loads; a browser
 * that didn't hand it over shows this page, which can't pass the fragment on without a script, so
 * it sends the learner back to the app to sign in again.
 */
export async function GET(request: NextRequest) {
  const locale = getLocaleFromRequest({
    acceptLanguage: request.headers.get("accept-language"),
    cookieLocale: request.cookies.get(LOCALE_COOKIE)?.value,
  });

  const t = await getExtracted({ locale });
  const title = escapeHtml(t("Go back to Zoonk"));

  const message = escapeHtml(
    t(
      "Your browser didn't open the Zoonk app. Close this page and sign in with Apple again in the app.",
    ),
  );

  const body = `<!doctype html><html lang="${escapeHtml(locale)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><title>${title}</title><style>${STYLE}</style></head><body><main><h1>${title}</h1><p>${message}</p></main></body></html>`;

  return new Response(body, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Security-Policy": CONTENT_SECURITY_POLICY,
      "Content-Type": "text/html; charset=utf-8",
      "Referrer-Policy": "no-referrer",
    },
  });
}
