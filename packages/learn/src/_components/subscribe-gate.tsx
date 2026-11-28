"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { DocumentLink } from "@zoonk/ui/patterns/links/pending";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { EnterLink } from "./enter-button";
import { TaskActions } from "./task-layout";

type GateLink = (props: { children: ReactNode; className?: string; href: string }) => ReactNode;

/** What stopped, and at most one line under it. */
/** A line that counts down shows each tick, while a screen reader hears `said` in its place. */
export function SaidLine({ line, said }: { line: ReactNode; said?: string }) {
  if (said === undefined) {
    return line;
  }

  return (
    <>
      <span aria-hidden="true" className="tabular-nums">
        {line}
      </span>
      <span className="sr-only">{said}</span>
    </>
  );
}

export function GateWords({
  line,
  provisional,
  said,
  title,
}: {
  line?: ReactNode;
  provisional?: boolean;
  said?: string;
  title?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5" data-slot="gate-words">
      {title && <p className="text-sm font-medium">{title}</p>}
      {line && (
        <p className={cn("text-muted-foreground text-sm", provisional && "invisible")}>
          <SaidLine line={line} said={said} />
        </p>
      )}
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
  provisional,
  title,
}: {
  /** A second way on that isn't paying, such as "See plan". */
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  provisional?: boolean;
  /** None where the screen's own title already says what stopped. */
  title?: string;
}) {
  const routes = useLearnRoutes();

  return (
    <div
      className={cn("flex flex-col items-start gap-2", className)}
      data-slot="subscribe-gate"
      role="status"
    >
      <GateWords line={children} provisional={provisional} title={title} />

      <div className="flex flex-wrap gap-2">
        <SubscribeAction href={routes.upgrade} link={LearnLink} />
        {action}
      </div>
    </div>
  );
}

/**
 * The gate as a screen: its words are the screen's, and this is the bar's main action, after
 * `action`, one way on that isn't paying.
 */
export function SubscribeMainAction({ action }: { action?: ReactNode }) {
  const t = useExtracted();
  const routes = useLearnRoutes();

  return (
    <TaskActions>
      {action}
      <EnterLink href={routes.upgrade}>{t("Subscribe")}</EnterLink>
    </TaskActions>
  );
}

/** The sign-up gate's one action, as a bar's main action. `href` comes back to where the guest was. */
export function SignUpMainLink({ href }: { href?: string }) {
  const t = useExtracted();
  const routes = useLearnRoutes();

  return (
    <EnterLink href={href ?? routes.signUp} link={DocumentLink}>
      {t("Create a free account")}
    </EnterLink>
  );
}

export function SignUpMainAction() {
  return (
    <TaskActions>
      <SignUpMainLink />
    </TaskActions>
  );
}
