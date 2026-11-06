/**
 * Next's canary React leaves text typed into a controlled input before hydration out of its state,
 * so the form's next reset would wipe it. As the input's `ref`, this hands that text to `setValue`.
 */
export function adoptTextTypedBeforeHydration(setValue: (value: string) => void) {
  return (input: HTMLInputElement | null) => {
    if (input) {
      setValue(input.value);
    }
  };
}
