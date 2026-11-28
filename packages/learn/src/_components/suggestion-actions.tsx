"use client";

import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { EnterButton } from "@zoonk/ui/components/enter-button";
import { OVERLAY_ACTIONS_CLASS } from "@zoonk/ui/lib/overlay-actions";
import { cn } from "@zoonk/ui/lib/utils";
import { createContext, use } from "react";
import { type LearnLinkComponentProps } from "../learn-context";
import { LearnLink } from "../learn-link";
import { EnterLink } from "./enter-button";
import { type Presentation, PresentationContext } from "./suggestion-presentation";

/** The sheet covers the page, so its main answer is the one Enter presses. */
const SheetMainAction = createContext(false);

/** In the panel each button fills its share of a row, so buttons that wrap stack at one width. */
const ACTIONS_CLASS: Readonly<Record<Presentation, string>> = {
  line: "flex max-w-full flex-wrap items-center gap-2",
  panel:
    "flex flex-wrap items-center gap-2 pt-1 [&>*]:h-auto [&>*]:min-h-7.5 [&>*]:max-w-full [&>*]:grow [&>*]:py-1 [&>*]:text-balance [&>*]:whitespace-normal",
  sheet: cn(OVERLAY_ACTIONS_CLASS, "pt-1"),
};

/**
 * The answers by role: `main`, the other one, then `menu` ("Other options"). The line and the panel
 * are part of the page and draw them in that order; the sheet is written as every sheet's foot is,
 * ending with `main`.
 */
export function SuggestionActions({
  children,
  className,
  main,
  menu,
}: React.PropsWithChildren<{
  className?: string;
  main?: React.ReactNode;
  menu?: React.ReactNode;
}>) {
  const presentation = use(PresentationContext);
  const sheet = presentation === "sheet";

  return (
    <div
      className={cn(ACTIONS_CLASS[presentation], "empty:hidden", className)}
      data-slot="suggestion-actions"
    >
      {sheet ? menu : main}
      {children}
      {sheet ? <SheetMainAction value>{main}</SheetMainAction> : menu}
    </div>
  );
}

function useActionSize(): "lg" | "sm" {
  return use(PresentationContext) === "sheet" ? "lg" : "sm";
}

/** As the sheet's main answer it is an `EnterButton`, whose one glyph is ⏎. */
export function SuggestionAction({
  icon,
  iconPosition,
  keyHint,
  variant,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size">) {
  const size = useActionSize();

  if (use(SheetMainAction)) {
    return <EnterButton {...props} />;
  }

  return (
    <Button
      focusableWhenDisabled
      icon={icon}
      iconPosition={iconPosition}
      keyHint={keyHint}
      size={size}
      variant={variant}
      {...props}
    />
  );
}

export function SuggestionLinkAction({
  children,
  className,
  variant = "default",
  ...props
}: LearnLinkComponentProps & { variant?: "default" | "outline" }) {
  const size = useActionSize();

  if (use(SheetMainAction)) {
    return (
      <EnterLink className={className} size="lg" {...props}>
        {children}
      </EnterLink>
    );
  }

  return (
    <LearnLink className={cn(buttonVariants({ size, variant }), className)} {...props}>
      {children}
    </LearnLink>
  );
}
