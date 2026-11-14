import { render } from "@testing-library/react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
} from "@zoonk/ui/components/alert-dialog";
import {
  Command,
  CommandDialog,
  CommandDialogTitle,
  CommandInput,
  CommandList,
} from "@zoonk/ui/components/command";
import { Drawer, DrawerPopup, DrawerTitle } from "@zoonk/ui/components/drawer";
import { SidePanel, SidePanelContent, SidePanelTitle } from "@zoonk/ui/components/side-panel";
import { useRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { commands, page } from "vitest/browser";

const WIDTHS = [
  { height: 812, name: "a phone", width: 375 },
  { height: 720, name: "a laptop", width: 1280 },
] as const;

function backdropStyle(slot: string) {
  const backdrop = document.querySelector(`[data-slot=${slot}]`);
  const style = backdrop ? getComputedStyle(backdrop) : null;

  return {
    blur: style?.backdropFilter ?? null,
    dim: style
      ? Math.round(alphaOf(style.backgroundColor) * Number(style.opacity) * 100) / 100
      : null,
  };
}

/** The color's alpha, from `rgba(…, a)` or a modern `…(… / a)`. */
function alphaOf(color: string) {
  const alpha = /\/\s*(?<slash>[\d.]+)\)$|,\s*(?<comma>[\d.]+)\)$/u.exec(color)?.groups;
  return Number(alpha?.slash ?? alpha?.comma ?? 1);
}

const OVERLAYS = [
  {
    name: "a confirm",
    slot: "alert-dialog-overlay",
    view: (
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>Delete it?</AlertDialogTitle>
        </AlertDialogContent>
      </AlertDialog>
    ),
  },
  {
    name: "a sheet",
    slot: "drawer-backdrop",
    view: (
      <Drawer open>
        <DrawerPopup>
          <DrawerTitle>Your buddy</DrawerTitle>
        </DrawerPopup>
      </Drawer>
    ),
  },
  {
    name: "a side panel",
    slot: "side-panel-overlay",
    view: (
      <SidePanel open>
        <SidePanelContent>
          <SidePanelTitle>Adjust your plan</SidePanelTitle>
        </SidePanelContent>
      </SidePanel>
    ),
  },
  {
    name: "the search palette",
    slot: "dialog-overlay",
    view: (
      <CommandDialog open>
        <CommandDialogTitle>Search</CommandDialogTitle>
        <Command inline items={[]} open>
          <CommandInput aria-label="Search" cancelLabel="Cancel" />
          <CommandList />
        </Command>
      </CommandDialog>
    ),
  },
];

const DIM_CASES = WIDTHS.flatMap((width) =>
  OVERLAYS.map((overlay) => ({
    ...overlay,
    height: width.height,
    pixels: width.width,
    width: width.name,
  })),
);

describe("one dim behind every overlay", () => {
  it.each(DIM_CASES)(
    "$name on $width dims at 50%, 70% in dark mode, with no blur",
    async ({ height, pixels, slot, view }) => {
      await page.viewport(pixels, height);
      render(view);

      await expect.poll(() => backdropStyle(slot)).toEqual({ blur: "none", dim: 0.5 });
      await commands.emulateMedia({ colorScheme: "dark" });
      await expect.poll(() => backdropStyle(slot).dim).toBe(0.7);
    },
  );
});

/** Opened as the apps open it: by an event, with focus handed back to the button. */
function Palette() {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button onClick={() => setOpen(true)} ref={opener} type="button">
        Search or ask
      </button>
      <CommandDialog finalFocus={opener} onOpenChange={setOpen} open={open}>
        <CommandDialogTitle>Search or ask</CommandDialogTitle>
        <Command inline items={[]} open>
          <CommandInput aria-label="Search or ask" cancelLabel="Cancel" />
          <CommandList />
        </Command>
      </CommandDialog>
    </>
  );
}

describe("the search palette's way out", () => {
  it("is the field's Esc keycap, a button that closes it, on a laptop", async () => {
    await page.viewport(1280, 720);
    render(<Palette />);
    const opener = page.getByRole("button", { name: "Search or ask" });
    await opener.click();

    const close = page.getByRole("button", { name: "Cancel Esc" });
    await expect.element(close).toBeVisible();

    await expect
      .element(page.getByRole("button", { exact: true, name: "Cancel" }))
      .not.toBeInTheDocument();

    await close.click();
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    await expect.element(opener).toHaveFocus();
  });

  it("is the word Cancel after the field on a phone", async () => {
    await page.viewport(375, 812);
    render(<Palette />);
    const opener = page.getByRole("button", { name: "Search or ask" });
    await opener.click();

    const cancel = page.getByRole("button", { exact: true, name: "Cancel" });
    await expect.element(cancel).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Cancel Esc" })).not.toBeInTheDocument();

    await cancel.click();
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    await expect.element(opener).toHaveFocus();
  });
});
