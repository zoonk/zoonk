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

/** A stacked variant keeps its room (`visibility`) so nothing jumps. Without `:has()` the default variant shows. */
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
 * No client code: native radios, every variant rendered, CSS showing the checked one. `name` must be
 * unique in the document, since the router keeps visited pages.
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

/** The radio is hidden from sight, not from the keyboard or screen readers. */
export function VariantSwitchOption({
  children,
  className,
  defaultValue,
  name,
  value,
}: {
  children: ReactNode;
  className?: string;
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

/** The caller stacks `stacked` variants in one grid cell. */
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

export const SEGMENTED_TRACK_CLASS = "bg-muted inline-flex rounded-lg p-[3px]";

export const SEGMENTED_OPTION_CLASS = cn(
  "text-muted-foreground hover:text-foreground inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-transparent px-3 text-[0.8125rem] font-medium whitespace-nowrap transition-colors motion-reduce:transition-none pointer-coarse:h-11",
  "has-checked:bg-background has-checked:text-foreground has-checked:border-input dark:has-checked:bg-surface-3",
  "has-focus-visible:ring-ring/50 has-focus-visible:ring-[3px]",
);
