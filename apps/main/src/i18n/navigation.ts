import { type SupportedLocale } from "@zoonk/utils/locale";
import { type Route } from "next";
import { createNavigation } from "next-intl/navigation";
import { type ComponentProps, type ReactNode } from "react";
import { routing } from "./routing";

type RootedRoute<Href extends string> = Href extends "/"
  ? `/${SupportedLocale}`
  : `/${SupportedLocale}${Href}`;

type UnrootedRoute<Href extends string> = Href extends `/${SupportedLocale}${infer Pathname}`
  ? Pathname extends ""
    ? "/"
    : Pathname
  : never;

/** Checks next-intl's unprefixed pathnames against Next.js's generated routes, which start with `[lang]`. */
export type AppRoute<Href extends string> = Href & UnrootedRoute<Route<RootedRoute<Href>>>;

const navigation = createNavigation(routing);

type LinkProps<Href extends string> = Omit<ComponentProps<typeof navigation.Link>, "href"> & {
  href: AppRoute<Href>;
};

type NavigationRouter = ReturnType<typeof navigation.useRouter>;
type NavigateOptions = Parameters<NavigationRouter["push"]>[1];
type PrefetchOptions = Parameters<NavigationRouter["prefetch"]>[1];

type TypedNavigationRouter = Omit<NavigationRouter, "prefetch" | "push" | "replace"> & {
  prefetch: <const Href extends string>(href: AppRoute<Href>, options?: PrefetchOptions) => void;
  push: <const Href extends string>(href: AppRoute<Href>, options?: NavigateOptions) => void;
  replace: <const Href extends string>(href: AppRoute<Href>, options?: NavigateOptions) => void;
};

export const Link = navigation.Link as <const Href extends string>(
  props: LinkProps<Href>,
) => ReactNode;
export const { getPathname, permanentRedirect, redirect, usePathname } = navigation;

export function useRouter(): TypedNavigationRouter {
  return navigation.useRouter() as TypedNavigationRouter;
}
