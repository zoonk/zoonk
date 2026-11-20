"use client";

import {
  type EnterLinkProps,
  EnterButton as KitEnterButton,
  EnterLink as KitEnterLink,
} from "@zoonk/ui/components/enter-button";
import { cn } from "@zoonk/ui/lib/utils";
import { LearnLink } from "../learn-link";
import { TASK_MAIN_ACTION_CLASS } from "./task-layout";

type Size = "lg" | "xl";

/** A task's main action is `xl` and takes its bar's width rules; a page's is `lg`. */
function mainActionClass(size: Size, className?: string) {
  return cn(size === "xl" && TASK_MAIN_ACTION_CLASS, className);
}

/** The kit's `EnterButton` at a task's size, unless it's given a page's (`lg`). */
export function EnterButton({
  className,
  size = "xl",
  ...props
}: Omit<React.ComponentProps<typeof KitEnterButton>, "className" | "size"> & {
  className?: string;
  size?: Size;
}) {
  return <KitEnterButton className={mainActionClass(size, className)} size={size} {...props} />;
}

type HostLink = React.ComponentProps<typeof KitEnterLink>["link"];

/**
 * The kit's `EnterLink` on the app's link. `link` is the host's own where the screen runs outside
 * the app's frame (a lesson, the sign-in pages).
 */
export function EnterLink({
  className,
  link,
  size = "xl",
  ...props
}: EnterLinkProps &
  Omit<React.ComponentProps<typeof LearnLink>, keyof EnterLinkProps> & { link?: HostLink }) {
  const classes = mainActionClass(size, className);

  return link ? (
    <KitEnterLink className={classes} link={link} size={size} {...props} />
  ) : (
    <KitEnterLink className={classes} link={LearnLink} size={size} {...props} />
  );
}
