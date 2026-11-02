import { getAppLocale } from "@/i18n/locale";
import { getPathname } from "@/i18n/navigation";
import { type MDXComponents } from "mdx/types";
import { type ComponentProps } from "react";

/** The legal pages link to app paths ("/terms"), which open in the language being read. */
async function LocalizedAnchor({ children, href, ...props }: ComponentProps<"a">) {
  const locale = await getAppLocale();

  return (
    <a {...props} href={href?.startsWith("/") ? getPathname({ href, locale }) : href}>
      {children}
    </a>
  );
}

const components: MDXComponents = { a: LocalizedAnchor };

export function useMDXComponents(): MDXComponents {
  return components;
}
