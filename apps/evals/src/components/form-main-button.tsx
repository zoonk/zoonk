"use client";

import { EnterButton } from "@zoonk/ui/components/enter-button";
import { useFormStatus } from "react-dom";

/** A form's main action for the bottom bar, busy while the form is pending; the bar sets its width. */
export function FormMainButton(
  props: Omit<React.ComponentProps<typeof EnterButton>, "busy" | "type">,
) {
  const status = useFormStatus();

  return <EnterButton busy={status.pending} type="submit" {...props} />;
}
