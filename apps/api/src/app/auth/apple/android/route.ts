/**
 * The App Link Apple sign-in returns to on Android. The Auth Tab hands it to the app before it
 * loads; a browser that doesn't shows main's inert page there. It's the same address in every
 * environment: the app links only zoonk.com, and Apple only returns to a registered reflector.
 */
const APP_LINK_URL = "https://zoonk.com/auth/apple";

/** Far above any real form Apple posts: a few short fields and an identity token of about a kilobyte. */
const MAX_BODY_LENGTH = 16_384;

/**
 * The fields of Apple's form post the app reads, each capped well above its real size. A first
 * authorization adds `user` (name and email); a cancelled or failed one sends `error` and `state`.
 */
const FIELD_LIMITS = { code: 512, error: 256, id_token: 8192, state: 512, user: 2048 };

const FORM_CONTENT_TYPE = "application/x-www-form-urlencoded";

function isForm(request: Request) {
  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  return contentType === FORM_CONTENT_TYPE;
}

/**
 * The kept fields as the App Link's fragment, or null when one is longer than any real value.
 * Each value is a URI component, so a space or a plus reads the same in any decoder.
 */
function getFragment(body: string) {
  const form = new URLSearchParams(body);

  const fields = Object.entries(FIELD_LIMITS).map(([name, limit]) => ({
    limit,
    name,
    value: form.get(name) ?? "",
  }));

  if (fields.some(({ limit, value }) => value.length > limit)) {
    return null;
  }

  return fields
    .filter(({ value }) => value)
    .map(({ name, value }) => `${name}=${encodeURIComponent(value)}`)
    .join("&");
}

/**
 * Apple form-posts the Android app's Sign in with Apple result here, the Services ID's registered
 * return URL, and this redirects it to the app's App Link with the fields in the fragment, which
 * never reaches a server. It keeps no state, reads and sets no cookie and never logs the body: the
 * app accepts only the one sign-in it started (its `state`), and the code and identity token are
 * useless without the raw nonce that stays in the app. Next.js answers other methods with 405.
 */
export async function POST(request: Request) {
  const body = isForm(request) ? await request.text() : "";
  const fragment = body && body.length <= MAX_BODY_LENGTH ? getFragment(body) : null;

  if (fragment === null) {
    return new Response(null, { headers: { "Cache-Control": "no-store" }, status: 400 });
  }

  return new Response(null, {
    headers: {
      "Cache-Control": "no-store",
      Location: `${APP_LINK_URL}#${fragment}`,
      "Referrer-Policy": "no-referrer",
    },
    status: 303,
  });
}
