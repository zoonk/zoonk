"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { EnterLink } from "./enter-button";
import { TaskActions } from "./task-layout";

type GateLink = (props: { children: ReactNode; className?: string; href: string }) => ReactNode;

/** What stopped, and at most one line under it. */
export function GateWords({ line, title }: { line?: ReactNode; title?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5" data-slot="gate-words">
      {title && <p className="text-sm font-medium text-pretty">{title}</p>}
      {line && <p className="text-muted-foreground text-sm text-pretty">{line}</p>}
    </div>
  );
}

/** The one action that leads to paying. `link` is the host's own outside the app's frame. */
export function SubscribeAction({ href, link: Link }: { href: string; link: GateLink }) {
  const t = useExtracted();

  return (
    <Link className={buttonVariants({ size: "sm", variant: "outline" })} href={href}>
      {t("Subscribe")}
    </Link>
  );
}

/**
 * Where a learner tried something that needs a subscription, in place of what they asked for:
 * what stopped as the title, at most one line, and "Subscribe". Nothing announces it before the try.
 */
export function SubscribeGate({
  action,
  children,
  className,
  title,
}: {
  /** A second way on that isn't paying, such as "Go to your Plan". */
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  title: string;
}) {
  const routes = useLearnRoutes();

  return (
    <div
      className={cn("flex flex-col items-start gap-2", className)}
      data-slot="subscribe-gate"
      role="status"
    >
      <GateWords line={children} title={title} />

      <div className="flex flex-wrap gap-2">
        <SubscribeAction href={routes.upgrade} link={LearnLink} />
        {action}
      </div>
    </div>
  );
}

/** The gate as a screen: its words are the screen's, and this is the bar's main action. */
export function SubscribeMainAction() {
  const t = useExtracted();
  const routes = useLearnRoutes();

  return (
    <TaskActions>
      <EnterLink href={routes.upgrade} icon={null}>
        {t("Subscribe")}
      </EnterLink>
    </TaskActions>
  );
}
