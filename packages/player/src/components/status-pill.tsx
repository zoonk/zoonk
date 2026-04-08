/**
 * A compact pill container with a subtle pulse animation on value change.
 *
 * Shared by story metric pills (showing color-coded metric values)
 * and investigation progress pills (showing evidence collection count).
 * The pill owns only the container styling and animation — each consumer
 * renders its own content as children.
 */
export function StatusPill({
  animationKey,
  children,
}: {
  animationKey: string | number;
  children: React.ReactNode;
}) {
  return (
    <span
      key={animationKey}
      className="animate-pulse-scale bg-muted/50 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 motion-reduce:animate-none"
    >
      {children}
    </span>
  );
}
