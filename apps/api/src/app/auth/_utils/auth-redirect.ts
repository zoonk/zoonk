/**
 * Where sign-in goes back to. Apps send `?redirectTo=` with their callback address; a sign-in that
 * started on the API itself has none, and then ends in the main app (see `/auth/callback`). Every
 * auth page carries the same value forward, and none of them prints or follows a missing one.
 */
export function readRedirectTo(value?: string | string[]): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function withRedirectTo<Path extends string>(path: Path, redirectTo: string | null) {
  if (!redirectTo) {
    return path;
  }

  return `${path}?${new URLSearchParams({ redirectTo }).toString()}` as const;
}

export function getCallbackHref(redirectTo: string | null) {
  return withRedirectTo("/auth/callback", redirectTo);
}

export function getSetupHref(redirectTo: string | null) {
  return withRedirectTo("/auth/setup", redirectTo);
}

export function getLoginHref(redirectTo: string | null) {
  return withRedirectTo("/auth/login", redirectTo);
}

export function getOtpHref({ email, redirectTo }: { email: string; redirectTo: string | null }) {
  const params = new URLSearchParams({ email });

  if (redirectTo) {
    params.set("redirectTo", redirectTo);
  }

  return `/auth/otp?${params.toString()}` as const;
}
