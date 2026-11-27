"use client";

import { useKeptTyping } from "@zoonk/ui/hooks/kept-typing";

/**
 * A native radio drawn by its label. A controlled one (`checked`) picked before the page hydrates
 * hands the pick to its `onChange` as it hydrates.
 */
export function RadioInput(props: Omit<React.ComponentProps<"input">, "type">) {
  const kept = useKeptTyping({ checked: props.checked });

  return <input {...props} type="radio" {...kept} />;
}
