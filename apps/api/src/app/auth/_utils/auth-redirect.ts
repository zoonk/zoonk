import { type SupportedLocale } from "@zoonk/utils/locale";

export function readRedirectTo(value?: string | string[]): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function readRedirectToParam(searchParams: URLSearchParams): string | null {
  const values = searchParams.getAll("redirectTo");
  return readRedirectTo(values.length === 1 ? values[0] : values);
}

function withRedirectTo<Path extends string>(path: Path, redirectTo: string | null) {
  if (!redirectTo) {
    return path;
  }

  return `${path}?${new URLSearchParams({ redirectTo }).toString()}` as const;
}

type AuthPageTarget = { locale: SupportedLocale; redirectTo: string | null };

export function getCallbackHref(redirectTo: string | null) {
  return withRedirectTo("/auth/callback", redirectTo);
}

export function getSetupHref({ locale, redirectTo }: AuthPageTarget) {
  return withRedirectTo(`/auth/${locale}/setup`, redirectTo);
}

export function getLoginHref({ locale, redirectTo }: AuthPageTarget) {
  return withRedirectTo(`/auth/${locale}/login`, redirectTo);
}

export function getOtpHref({ email, locale, redirectTo }: AuthPageTarget & { email: string }) {
  const params = new URLSearchParams({ email });

  if (redirectTo) {
    params.set("redirectTo", redirectTo);
  }

  return `/auth/${locale}/otp?${params.toString()}` as const;
}

export function getUntrustedOriginHref(locale: SupportedLocale) {
  return `/auth/${locale}/untrusted-origin` as const;
}
