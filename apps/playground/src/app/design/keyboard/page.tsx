import { SHORTCUTS, type ShortcutName, shortcutKeys } from "@zoonk/ui/lib/shortcuts";
import { type Metadata } from "next";
import { DocHeader, DocRules, DocSection } from "../_components/doc";
import { KeyCap } from "./key-cap";

export const metadata: Metadata = { title: "Keyboard" };

const RULES = [
  "The same control answers the same key on every screen. A key lives in the piece that draws its control: `SidebarToggle` carries the sidebar's, `TaskClose` carries Esc on a task, `EnterButton` and `EnterLink` carry Enter, and the app's root layout carries search.",
  "Every key below comes from `SHORTCUTS` in `@zoonk/ui/lib/shortcuts`. Handlers take a name (`useShortcut`), keycaps take a name (`ShortcutKbd`), and `shortcutKeys` gives `aria-keyshortcuts`, so a keycap can't show a key nothing answers.",
  "A key presses only a control that is on screen, and does what a click on it does.",
  "Esc closes what is open. With nothing open it presses the ✕ or the way back that is drawn, and where leaving would lose work both ask first.",
  "A control keeps its own keys when it has focus: a field its text, a menu its arrows, a button its Enter.",
] as const;

const NAMES = Object.keys(SHORTCUTS).filter((name): name is ShortcutName => name in SHORTCUTS);

function KeyRow({ name }: { name: ShortcutName }) {
  return (
    <tr className="border-b last:border-0">
      <td className="py-2.5 pr-4">
        <KeyCap shortcut={name} />
        <span className="sr-only">{shortcutKeys(name)}</span>
      </td>
      <td className="py-2.5 pr-4 leading-6">{SHORTCUTS[name].does}</td>
      <td className="py-2.5">
        <code className="text-muted-foreground font-mono text-xs">{name}</code>
      </td>
    </tr>
  );
}

function KeysTable() {
  return (
    <table className="w-full text-left text-sm">
      <thead className="text-muted-foreground text-xs">
        <tr className="border-b">
          <th className="py-2 pr-4 font-medium">Key</th>
          <th className="py-2 pr-4 font-medium">What it does</th>
          <th className="py-2 font-medium">Name</th>
        </tr>
      </thead>
      <tbody>
        {NAMES.map((name) => (
          <KeyRow key={name} name={name} />
        ))}
      </tbody>
    </table>
  );
}

export default function KeyboardPage() {
  return (
    <>
      <DocHeader title="Keyboard">
        Every key the product answers beyond the control in focus, read from the same list the
        handlers and the keycaps use.
      </DocHeader>

      <DocSection title="Rules">
        <DocRules rules={RULES} />
      </DocSection>

      <DocSection title="Keys">
        <div className="max-w-column overflow-x-auto">
          <KeysTable />
        </div>
      </DocSection>
    </>
  );
}
