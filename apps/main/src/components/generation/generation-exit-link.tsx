import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { type Route } from "next";
import Link from "next/link";

/**
 * Gives learners a quiet way out of generated-content waiting states. Keeping
 * this as a plain server-rendered link means streaming components can keep one
 * job: start, display, and clean up the workflow stream.
 */
export function GenerationExitLink<Href extends string>({
  children,
  href,
}: {
  children: React.ReactNode;
  href: Route<Href>;
}) {
  return (
    <Link className={cn(buttonVariants(), "w-max")} href={href} prefetch>
      {children}
    </Link>
  );
}
