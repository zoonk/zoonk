"use client";

/**
 * next-intl's provider itself, for a Server Component that hands it its config. Imported in a
 * Server Component, `NextIntlClientProvider` is an async wrapper that reads the request's config
 * first, so what it wraps streams a step later: content that must render in one pass (what a
 * page's first paint waits for, `FirstPaintContent`) reads that config with its own data.
 */
export { NextIntlClientProvider } from "next-intl";
