import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Checks if the browser supports CSS `field-sizing: content`.
 * We cache this check to avoid repeated DOM operations.
 */
let fieldSizingSupported: boolean | null = null;

function isFieldSizingSupported(): boolean {
  if (fieldSizingSupported !== null) return fieldSizingSupported;
  if (typeof window === "undefined") return true;
  fieldSizingSupported = CSS.supports("field-sizing", "content");
  return fieldSizingSupported;
}

/**
 * Resizes a textarea to fit its content by setting height to scrollHeight.
 */
function resizeTextarea(textarea: HTMLTextAreaElement): void {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

type UseAutoResizeOptions = {
  value?: string;
};

/**
 * Auto-resizes a textarea to fit its content when CSS `field-sizing: content`
 * is not supported (e.g., older Safari versions).
 *
 * Returns a ref callback to attach to the textarea element.
 */
export function useAutoResize({ value }: UseAutoResizeOptions = {}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const needsJsResize = !isFieldSizingSupported();

  useLayoutEffect(() => {
    if (!needsJsResize || !textareaRef.current) return;
    resizeTextarea(textareaRef.current);
  }, [needsJsResize, value]);

  useLayoutEffect(() => {
    if (!needsJsResize || !textareaRef.current) return;

    const textarea = textareaRef.current;
    const handleInput = () => resizeTextarea(textarea);
    textarea.addEventListener("input", handleInput);

    return () => textarea.removeEventListener("input", handleInput);
  }, [needsJsResize]);

  const refCallback = useCallback(
    (node: HTMLTextAreaElement | null) => {
      textareaRef.current = node;
      if (needsJsResize && node) {
        resizeTextarea(node);
      }
    },
    [needsJsResize],
  );

  return refCallback;
}
