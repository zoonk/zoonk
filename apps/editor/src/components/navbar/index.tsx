"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { Navbar } from "@zoonk/ui/components/navbar";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { HomeIcon } from "lucide-react";
import { useParams, useSelectedLayoutSegments } from "next/navigation";
import { useExtracted } from "next-intl";
import { Link } from "@/i18n/navigation";

export function NavbarSkeleton() {
  return (
    <Navbar>
      <Skeleton className="size-9 rounded-full" />
      <Skeleton className="h-8 w-36 rounded-full" />
    </Navbar>
  );
}

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
          prefetch={true}
        >
          <HomeIcon aria-hidden="true" />
          <span className="sr-only">{t("Home page")}</span>
        </Link>
      </div>

      {children}
    </Navbar>
  );
}
