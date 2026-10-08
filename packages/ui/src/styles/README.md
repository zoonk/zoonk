# Styles

Shared styles for all our applications.

## Usage

```tsx
import "@zoonk/ui/styles/global.css";
```

## Themes

There is one visual language. Its semantic tokens live in `globals.css`, with light and dark values; the `dark:` variant and the dark tokens follow the device's theme.

## Accessibility

Text tokens keep WCAG AA (4.5:1) on the surfaces they sit on, including their own tints (`bg-destructive/10 text-destructive`). With reduced motion, `globals.css` turns tw-animate-css's zoom, slide and spin into plain fades, so dialogs, menus and sheets have a calm version too. Accessibility scans run axe on every learner-facing screen, once, where a test already shows it: the apps' E2E flows (`expectAccessibleScreen` in `packages/e2e/src/fixtures/accessibility.ts`) and, for the lesson player's screens and all its activities, `packages/player`'s browser tests. Screens are scanned in light and dark.

Everything people tap or click is at least 44 px each way (WCAG 2.2's 24 px is the floor; 44 px is our rule), and the same scans fail on any smaller target (`findSmallTargets` in `packages/testing/src/accessibility/target-size.ts`). A control can look smaller when `hit-area` (`hit-area.css`) grows where it can be pressed, as `Button` does; form fields are 44 px tall. The only exception is a target inside running text, such as a link in a sentence or a word in a passage that opens its meaning, whose height comes from the line around it.
