# Styles

Shared styles for all our applications.

## Usage

```tsx
import "@zoonk/ui/styles/global.css";
```

## Fun mode

Apps that offer Fun mode also import its token layer after the globals:

```css
@import "@zoonk/ui/globals.css";
@import "@zoonk/ui/fun.css";
```

Everything in `fun.css` is scoped to `[data-mode="fun"]`, so Focus keeps the tokens in `globals.css`. Fun is dark only; Focus follows the device. Fun's canvas is always deep space, even on a light device, and reading happens on a light paper panel (`fun-paper`, with its own palette). The `dark:` variant and the dark tokens in `globals.css` apply inside Fun too, so a Fun screen on a light device renders as it does on a dark one, and the document behind a Fun page (the mode root is `display: contents`) gets deep space and `color-scheme: dark` from its first paint. On a hard load, the skeleton that paints before the learner's mode is known sits in `DeviceModeRoot` (`@zoonk/learn/mode`), which takes the mode the device keeps in the `zoonk_mode` cookie (left by `ModeProvider`), so a Fun learner's page is deep space from the first frame too. Existing components follow Fun through the shared semantic tokens; `fun-utilities.css` adds the Fun surfaces (`fun-space`, `fun-glass`, `fun-dock`, `fun-paper`, `fun-card-*`, `fun-planet`, `fun-holo-*`) and motion (`animate-fun-*`, with reduced-motion versions). The app loads Unbounded and Figtree and exposes them as `--font-unbounded` and `--font-figtree`.

`fun-contrast.test.ts` reads the palettes from `fun.css` and checks every text and control pair against WCAG AA. Run it after changing a Fun color.

## Accessibility

Text tokens keep WCAG AA (4.5:1) on the surfaces they sit on, including their own tints (`bg-destructive/10 text-destructive`). With reduced motion, `globals.css` turns tw-animate-css's zoom, slide and spin into plain fades, so dialogs, menus and sheets have a calm version too. The E2E accessibility suites (`apps/main/e2e/accessibility-*.test.ts`, `apps/api/e2e/accessibility.test.ts`) scan every learner-facing screen with axe in both modes at phone and desktop widths: Focus in light and dark, and Fun once, on a light device, where each scan also checks it stays dark.

Everything people tap or click is at least 44 px each way (WCAG 2.2's 24 px is the floor; 44 px is our rule), and the same scans fail on any smaller target (`findSmallTargets` in `packages/e2e/src/fixtures/accessibility.ts`). A control can look smaller when `hit-area` (`hit-area.css`) grows where it can be pressed, as `Button` does; form fields are 44 px tall. The only exception is a target inside running text, such as a link in a sentence or a word in a passage that opens its meaning, whose height comes from the line around it.
