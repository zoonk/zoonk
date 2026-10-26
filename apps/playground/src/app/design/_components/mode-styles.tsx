"use client";

import { useSyncExternalStore } from "react";
import { MODES, type ModeId, modeClass } from "./modes";

type Scope = "root" | "subject";
type Declarations = Map<string, string>;
type Collected = Record<Scope, Record<ModeId, Declarations>>;

/** The roles a subject's table gives (its hue and chroma stay the subject's own). */
const SUBJECT_ROLES = new Set(["--subject", "--subject-text", "--subject-tint"]);

function emptyModes(): Record<ModeId, Declarations> {
  return { dark: new Map(), "dark-more": new Map(), light: new Map(), "light-more": new Map() };
}

/** Whether a rule under these media conditions is part of a mode, as the device would apply it. */
function appliesTo(mode: ModeId, conditions: readonly string[]): boolean {
  const text = conditions.join(" and ");
  const dark = mode.startsWith("dark");
  const more = mode.endsWith("more");

  if (conditions.some((condition) => !/prefers-(?:color-scheme|contrast)/u.test(condition))) {
    return false;
  }

  if (/prefers-color-scheme:\s*dark/u.test(text) && !dark) {
    return false;
  }

  if (/prefers-color-scheme:\s*light/u.test(text) && dark) {
    return false;
  }

  return !/prefers-contrast:\s*more/u.test(text) || more;
}

function scopeOf(selectorText: string): Scope | null {
  if (selectorText.split(",").some((selector) => selector.trim() === ":root")) {
    return "root";
  }

  return selectorText.trim() === "[data-subject]" ? "subject" : null;
}

/** Walks the stylesheet's rules in order, through media, supported and layer blocks. */
function walk(
  rules: CSSRuleList,
  conditions: readonly string[],
  visit: (scope: Scope, style: CSSStyleDeclaration, conditions: readonly string[]) => void,
) {
  for (const rule of rules) {
    if (rule instanceof CSSMediaRule) {
      walk(rule.cssRules, [...conditions, rule.conditionText], visit);
    } else if (rule instanceof CSSSupportsRule) {
      if (CSS.supports(rule.conditionText)) {
        walk(rule.cssRules, conditions, visit);
      }
    } else if (rule instanceof CSSLayerBlockRule) {
      walk(rule.cssRules, conditions, visit);
    } else if (rule instanceof CSSStyleRule) {
      const scope = scopeOf(rule.selectorText);

      if (scope) {
        visit(scope, rule.style, conditions);
      }
    }
  }
}

function readRules(sheet: CSSStyleSheet): CSSRuleList | null {
  try {
    return sheet.cssRules;
  } catch {
    return null;
  }
}

/** Every mode's custom properties, as the app's own stylesheets declare them, in order. */
function collect(): { collected: Collected; themed: Set<string> } {
  const collected: Collected = { root: emptyModes(), subject: emptyModes() };
  const themed = new Set<string>();

  for (const sheet of document.styleSheets) {
    const rules = readRules(sheet);

    if (rules) {
      walk(rules, [], (scope, style, conditions) => {
        for (const property of style) {
          if (property.startsWith("--")) {
            const value = style.getPropertyValue(property).trim();

            // A mode's own value, or one read from other tokens (`--selected: var(--foreground)`),
            // which resolves where it's declared, so each mode's class declares it again.
            if (scope === "root" && (conditions.length > 0 || value.includes("var("))) {
              themed.add(property);
            }

            for (const mode of MODES) {
              if (appliesTo(mode.id, conditions)) {
                collected[scope][mode.id].set(property, value);
              }
            }
          }
        }
      });
    }
  }

  return { collected, themed };
}

/**
 * One class per mode with that mode's tokens (`ds-mode-dark`, …), copied as written from the app's
 * stylesheet, so a swatch in it reads the real value through `var()` whatever the device's mode.
 */
function buildModeCss(): string {
  const { collected, themed } = collect();

  return MODES.map(({ id }) => {
    const root = [...themed]
      .filter((property) => collected.root[id].has(property))
      .map((property) => `${property}: ${collected.root[id].get(property)};`);

    const subject = [...collected.subject[id]]
      .filter(([property]) => SUBJECT_ROLES.has(property))
      .map(([property, value]) => `${property}: ${value};`);

    const scheme = id.startsWith("dark") ? "dark" : "light";
    const selector = `.${modeClass(id)}`;

    return [
      `${selector} { ${root.join(" ")} color-scheme: ${scheme}; background-color: var(--background); color: var(--foreground); }`,
      `${selector} [data-subject], ${selector}[data-subject] { ${subject.join(" ")} }`,
    ].join("\n");
  }).join("\n");
}

let modeCss: string | null = null;

function stopListening(): void {
  // Nothing was listened to: the stylesheet stays as it loaded while the page is open.
}

function subscribe(): () => void {
  return stopListening;
}

function getSnapshot(): string {
  modeCss ??= buildModeCss();
  return modeCss;
}

function getServerSnapshot(): string {
  return "";
}

/** The modes' classes once they're read (an empty string on the server and before). */
export function useModeCss(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Adds the four modes' classes to the page, read from `globals.css` as the browser loaded it, so
 * the design system shows every mode side by side without a second copy of any value.
 */
export function ModeStyles() {
  const css = useModeCss();
  return css ? <style>{css}</style> : null;
}
