"use client";

import { BusyContent, Button, buttonVariants } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { shortcutKeys } from "@zoonk/ui/lib/shortcuts";
import { cn, mergeRefs } from "@zoonk/ui/lib/utils";

/**
 * `bound`: Enter presses it while it's drawn, enabled and not busy. `host`: the screen binds Enter
 * itself, because when it may press depends on the step, or a field or its own focus already gives
 * it Enter. `off`: Enter must not press it (handing in), so it shows no ⏎ either.
 */
export type Enter = "bound" | "host" | "off";

type ButtonProps = React.ComponentProps<typeof Button>;

const ENTER_HINT = <ShortcutKbd shortcut="main" tone="inverse" />;

/**
 * A screen's main action, and the one home of Enter, the ⏎ hint and the busy look: a screen gets
 * all three by drawing it. Its one glyph is the ⏎ keycap, so it takes no icon; on a touch screen
 * it is its label alone. Acting, it shows `busy` (a spinner in the keycap's place, or over the
 * label where there is no keycap) and blocks a second press; it is never only disabled.
 */
export function EnterButton({
  busy = false,
  children,
  disabled = false,
  enter = "bound",
  ref,
  ...props
}: Omit<ButtonProps, "icon" | "iconPosition" | "keyHint" | "variant"> & { enter?: Enter }) {
  const enterRef = useEnterClick<HTMLButtonElement>({
    enabled: enter === "bound" && !disabled && !busy,
    focus: true,
  });

  return (
    <Button
      aria-keyshortcuts={enter === "off" ? undefined : shortcutKeys("main")}
      busy={busy}
      data-enter={enter}
      disabled={disabled}
      focusableWhenDisabled
      keyHint={enter === "off" ? undefined : ENTER_HINT}
      ref={mergeRefs(enterRef, ref)}
      {...props}
    >
      {children}
    </Button>
  );
}

export type EnterLinkHostProps = {
  "aria-keyshortcuts"?: string;
  children: React.ReactNode;
  className?: string;
  href: string;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  ref?: React.Ref<HTMLAnchorElement>;
};

export type EnterLinkProps = Pick<EnterLinkHostProps, "href" | "onClick" | "ref"> & {
  children: React.ReactNode;
  className?: string;
  /** False while Enter must wait, such as during a goal switch. */
  enabled?: boolean;
  size?: "lg" | "xl";
};

/** The same main action as a link, drawn with the app's own `link`. Further props go to the link. */
export function EnterLink<Extra extends object>({
  children,
  className,
  enabled = true,
  link: Link,
  ref,
  size = "lg",
  ...props
}: EnterLinkProps & Extra & { link: React.ComponentType<EnterLinkHostProps & Extra> }) {
  const enterRef = useEnterClick<HTMLAnchorElement>({ enabled });

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The rest is the link's own props, which TypeScript can't prove once the named ones are taken out.
  const linkProps = props as EnterLinkHostProps & Extra;

  return (
    <Link
      {...linkProps}
      aria-keyshortcuts={shortcutKeys("main")}
      className={cn(buttonVariants({ size }), className)}
      data-enter="bound"
      ref={mergeRefs(enterRef, ref)}
    >
      <BusyContent keyHint={ENTER_HINT}>{children}</BusyContent>
    </Link>
  );
}
