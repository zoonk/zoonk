"use client";

import { type Dialog } from "@base-ui/react/dialog";
import { useRef } from "react";

type InitialFocus = Dialog.Popup.Props["initialFocus"];

/**
 * A field, a choice included (the checked radio of a group is the one it can focus). Choice pieces
 * carry a hidden input that never takes focus.
 */
const FIRST_FIELD =
  "input:not([type=hidden],[disabled],[tabindex='-1']),textarea:not([disabled]),select:not([disabled]),[role=radio][tabindex='0'],[role=checkbox]:not([aria-disabled=true])";

/**
 * A panel opens on its first field, else on itself, never on its ✕ or Cancel: Enter there would
 * press that button instead of the panel's main action. `opensOnField: false` is for a panel opened
 * to show something first, whose field comes second. Put the returned `ref` on the popup.
 */
export function useOpeningFocus<Popup extends HTMLElement>({
  initialFocus,
  opensOnField = true,
}: {
  initialFocus: InitialFocus;
  opensOnField?: boolean;
}) {
  const ref = useRef<Popup>(null);

  return {
    initialFocus:
      initialFocus ??
      (() =>
        (opensOnField && ref.current?.querySelector<HTMLElement>(FIRST_FIELD)) ||
        ref.current ||
        true),
    ref,
  };
}
