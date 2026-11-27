import { type ComponentProps, useEffectEvent, useId, useLayoutEffect, useState } from "react";
import { KEEP_TYPING_ATTRIBUTE, KEPT_PICK } from "../lib/kept-typing-script";

type FieldValue = ComponentProps<"input">["value"];
type KeptField = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/**
 * React hydrates a text field with its value tracker holding the words on screen, so an input event
 * carrying them reads as no change. Writing the field's own value through the tracker first makes
 * them a change, which the event hands to the field's handlers. Those writes move the caret to the
 * end, so it goes back where the learner left it. A select has no tracker, and React hears its
 * picks as `change`.
 */
function typeAgain(field: KeptField, own: string, typed: string) {
  if (field instanceof HTMLSelectElement) {
    field.value = typed;
    field.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }

  const { selectionDirection, selectionEnd, selectionStart } = field;

  field.value = own;
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), "value")?.set?.call(field, typed);
  field.dispatchEvent(new Event("input", { bubbles: true }));

  if (selectionStart !== null && selectionEnd !== null && document.activeElement === field) {
    field.setSelectionRange(selectionStart, selectionEnd, selectionDirection ?? undefined);
  }
}

/**
 * Hydration keeps a radio picked before it, and its value tracker with it, so a click on it reads as
 * no change. Unpicking it through the tracker first makes the click a pick, which it hands to the
 * radio's `onChange`.
 */
function pickAgain(radio: HTMLInputElement) {
  radio.checked = false;
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(radio), "checked")?.set?.call(radio, true);
  radio.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

function handOverTo(
  field: KeptField,
  { checked, last, own }: { checked?: boolean; last: string; own: string },
) {
  if (field instanceof HTMLInputElement && field.type === "radio") {
    if (last === KEPT_PICK && field.checked && !checked) {
      pickAgain(field);
    }

    return;
  }

  if (last !== own) {
    typeAgain(field, own, last);
  }
}

/**
 * Spread last on a text field, a select or a controlled radio (`checked`). With `KEEP_TYPING_SCRIPT`
 * in the page's `<head>`, words typed or an option picked before the field hydrated stay on screen
 * as it does, then reach its `onChange` as if typed or picked just then.
 */
export function useKeptTyping({
  checked,
  defaultValue,
  value,
}: {
  checked?: boolean;
  defaultValue?: FieldValue;
  value?: FieldValue;
}) {
  const key = useId();
  const [typed, setTyped] = useState(() => globalThis.zoonkKeptTyping?.typed.get(key));

  const handOver = useEffectEvent((last: string) => {
    const field = document.querySelector<KeptField>(
      `[${KEEP_TYPING_ATTRIBUTE}="${CSS.escape(key)}"]`,
    );

    if (field) {
      handOverTo(field, { checked, last, own: String(value ?? defaultValue ?? "") });
    }

    setTyped(undefined);
  });

  useLayoutEffect(() => {
    const kept = globalThis.zoonkKeptTyping;

    if (!kept) {
      return;
    }

    const last = kept.typed.get(key);
    kept.typed.delete(key);
    kept.taken.add(key);

    if (last !== undefined) {
      // oxlint-disable-next-line react/set-state-in-effect -- Only a hydrated field can take the words over; this render lands before the paint.
      handOver(last);
    }
  }, [key]);

  return {
    [KEEP_TYPING_ATTRIBUTE]: key,
    ...(checked === undefined && drawTyped({ typed, value })),
  };
}

/** Hydration puts a textarea or a select back to its server value, so the hydrating render draws the typed one. */
function drawTyped({ typed, value }: { typed: string | undefined; value: FieldValue }) {
  if (typed === undefined) {
    return {};
  }

  return value === undefined ? { defaultValue: typed } : { value: typed };
}
