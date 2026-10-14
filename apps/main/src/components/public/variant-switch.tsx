import { cn } from "@zoonk/ui/lib/utils";
import { type ReactNode } from "react";

/** Names and values go into CSS selectors, so they keep to letters, digits and dashes. */
const SAFE_TOKEN = /^[a-z0-9-]+$/iu;

function assertSafeToken(token: string) {
  if (!SAFE_TOKEN.test(token)) {
    throw new Error(`A variant switch's names and values are letters, digits and dashes: ${token}`);
  }
}

function getVariantSelector({ name, value }: { name: string; value: string }) {
  return `[data-variant="${name}:${value}"]`;
}

/**
 * The switch's rules: a variant shows only while its option is checked. A stacked variant keeps
 * its room (`visibility`), so a window as tall as its tallest variant doesn't jump; the others
 * leave the page (`display`). Both hide what screen readers would read too. Without `:has()` the
 * default variant shows and the rest stay hidden.
 */
function getVariantSwitchCss({
  defaultValue,
  name,
  values,
}: {
  defaultValue: string;
  name: string;
  values: readonly string[];
}) {
  const checked = (value: string) =>
    `:root:not(:has(input[name="${name}"][value="${value}"]:checked))`;

  const hidden = values.map((value) => {
    const variant = getVariantSelector({ name, value });

    return [
      `${checked(value)} ${variant}:not([data-variant-stacked]){display:none}`,
      `${checked(value)} ${variant}[data-variant-stacked]{visibility:hidden}`,
    ].join("");
  });

  const fallback = values
    .filter((value) => value !== defaultValue)
    .map((value) => {
      const variant = getVariantSelector({ name, value });
      return `${variant}:not([data-variant-stacked]){display:none}${variant}[data-variant-stacked]{visibility:hidden}`;
    });

  return `@supports selector(:has(*)){${hidden.join("")}}@supports not selector(:has(*)){${fallback.join("")}}`;
}

/**
 * A choice a visitor makes to see the product respond (an example goal, yesterday studied or not,
 * a pace, a billing period), with no client code: native radios in a labeled group, and every
 * variant the server renders, of which CSS shows the one checked (`Variant`). The group is a
 * `radiogroup`: Tab reaches the checked option, the arrow keys move between them, each option
 * draws the focus ring, and only the chosen variant is in the page for screen readers.
 *
 * `name` names the radios, so it's unique in the document, as the router keeps visited pages:
 * a page's name, plus its course for a course page's.
 *
 * ```tsx
 * <VariantSwitch aria-labelledby="pace-label" defaultValue="15" name="pace-c1" values={["10", "15"]}>
 *   <VariantSwitchOption defaultValue="15" name="pace-c1" value="10">10 min</VariantSwitchOption>
 *   <VariantSwitchOption defaultValue="15" name="pace-c1" value="15">15 min</VariantSwitchOption>
 * </VariantSwitch>
 * <Variant name="pace-c1" value="10">…</Variant>
 * ```
 */
export function VariantSwitch({
  children,
  className,
  defaultValue,
  name,
  values,
  ...props
}: Omit<React.ComponentProps<"div">, "defaultValue"> & {
  defaultValue: string;
  name: string;
  values: readonly string[];
}) {
  [name, ...values].forEach((token) => assertSafeToken(token));

  return (
    <div className={className} data-variant-switch={name} role="radiogroup" {...props}>
      <style href={`variant-switch-${name}`} precedence="default">
        {getVariantSwitchCss({ defaultValue, name, values })}
      </style>

      {children}
    </div>
  );
}

/**
 * One option: its label, which holds the radio, so a tap anywhere on it picks it. The radio is
 * hidden from sight, not from the keyboard or screen readers; the label draws its checked state
 * (`has-checked:`) and its focus ring (`has-focus-visible:`) through `className`, or one of the
 * looks below.
 */
export function VariantSwitchOption({
  children,
  className,
  defaultValue,
  name,
  value,
}: {
  children: ReactNode;
  className?: string;
  /** The switch's default, which this option is checked as when it's the same. */
  defaultValue: string;
  name: string;
  value: string;
}) {
  return (
    <label className={cn("relative cursor-pointer", className)} data-slot="variant-switch-option">
      <input
        className="sr-only"
        defaultChecked={value === defaultValue}
        name={name}
        type="radio"
        value={value}
      />
      {children}
    </label>
  );
}

/**
 * What one option shows. `stacked` variants share one place and keep their room, so switching
 * between them never moves what's under them; the caller stacks them (one grid cell).
 */
export function Variant({
  as: Element = "div",
  children,
  className,
  name,
  stacked = false,
  value,
}: {
  as?: "div" | "li" | "span";
  children: ReactNode;
  className?: string;
  name: string;
  stacked?: boolean;
  value: string;
}) {
  return (
    <Element
      className={className}
      data-variant={`${name}:${value}`}
      data-variant-stacked={stacked || undefined}
    >
      {children}
    </Element>
  );
}

/** A switch as the app's segmented control: a muted track with the chosen option raised on it. */
export const SEGMENTED_TRACK_CLASS = "bg-muted inline-flex rounded-lg p-[3px]";

/** An option on the segmented track: 32px, 44px on touch screens. */
export const SEGMENTED_OPTION_CLASS = cn(
  "text-muted-foreground hover:text-foreground inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-transparent px-3 text-[0.8125rem] font-medium whitespace-nowrap transition-colors motion-reduce:transition-none pointer-coarse:h-11",
  "has-checked:bg-background has-checked:text-foreground has-checked:border-input dark:has-checked:bg-surface-3",
  "has-focus-visible:ring-ring/50 has-focus-visible:ring-[3px]",
);

/**
 * A switch as the app's presets (an amount of time): the strong line, and once picked the
 * learner's blue ring and tint, as every pick in the app (`ANSWER_TONE.picked`, onboarding's time
 * chips), since the time picked is theirs: "Build my plan" starts with it. 36px, 44px on touch
 * screens.
 */
export const PRESET_OPTION_CLASS = cn(
  "ring-input text-muted-foreground hover:bg-muted inline-flex h-9 items-center justify-center rounded-lg px-3 font-mono text-[0.8125rem] tabular-nums ring-1 transition-colors ring-inset motion-reduce:transition-none pointer-coarse:h-11",
  "has-checked:bg-selected-tint has-checked:text-foreground has-checked:ring-selected has-checked:ring-2",
  "has-focus-visible:ring-ring/50 has-focus-visible:ring-[3px]",
);
