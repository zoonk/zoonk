import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type PageTopClasses = { bar: string; header: string; row: string };

/** Read the measured checkout's shared classes, including its spacing tokens. */
export function readPageTopClasses(checkout: string): PageTopClasses | null {
  if (!existsSync(join(checkout, "packages/ui/src/components/page-header-class.tsx"))) {
    return null;
  }

  const component =
    readFileSync(join(checkout, "packages/ui/src/components/page-top.tsx"), "utf8")
      .split("function PageTopBar(")[1]
      ?.split("function PageTop(")[0] ?? "";

  const headerSource = readFileSync(
    join(checkout, "packages/ui/src/components/page-header-class.tsx"),
    "utf8",
  );

  const bar = /"(?<classes>[^"\n]*\bpt-[^"\s]+[^"\n]*)"/u.exec(component)?.groups?.classes;

  const row = /className="(?<classes>[^"\n]*\bmin-h-[^"\s]+[^"\n]*)"/u.exec(component)?.groups
    ?.classes;

  const header = /PAGE_HEADER_CLASS\s*=\s*"(?<classes>[^"\n]+)"/u.exec(headerSource)?.groups
    ?.classes;

  if (!bar || !row || !header) {
    throw new Error("Cannot read PageTopBar and PAGE_HEADER_CLASS for the E8 measurement");
  }

  return { bar, header, row };
}
