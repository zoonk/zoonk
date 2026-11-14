/** Script-disabled srcdoc rejects init probes before they can identify the frame. */
export function isBlockedFrameProbe({
  argumentsCount,
  text,
  url,
}: {
  argumentsCount: number;
  text: string;
  url: string;
}): boolean {
  return (
    argumentsCount === 0 &&
    url === "about:srcdoc" &&
    text ===
      "Blocked script execution in 'about:srcdoc' because the document's frame is sandboxed and the 'allow-scripts' permission is not set."
  );
}
