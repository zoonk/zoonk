"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { Navbar } from "@zoonk/ui/components/navbar";
import { cn } from "@zoonk/ui/lib/utils";
import { HomeIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import Link from "next/link";
import { useParams, useSelectedLayoutSegments } from "next/navigation";
import { CommandPalette } from "./command-palette";

export function EditorNavbar({ children }: React.PropsWithChildren) {
  const t = useExtracted();
  const { orgSlug } = useParams<{ orgSlug: string }>();

  const segments = useSelectedLayoutSegments();
  const isHome = segments.length === 0;
  const isNewCourse = segments.includes("new-course");

  if (isNewCourse) {
    return null;
  }

  return (
    <Navbar>
      <div className="flex items-center gap-2">
        <Link
          className={cn(
            buttonVariants({
              size: "icon",
              variant: isHome ? "default" : "outline",
            }),
          )}
          href={`/${orgSlug}`}
          prefetch
        >
          <HomeIcon aria-hidden="true" />
          <span className="sr-only">{t("Home page")}</span>
        </Link>

        <CommandPalette />
      </div>

      {children}
    </Navbar>
  );
}
