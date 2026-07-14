export function FullPageLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading"
      className="bg-background fixed inset-0 flex items-center justify-center"
      role="status"
    >
      <div
        aria-hidden="true"
        className="bg-foreground/80 animate-breathe inset-0 size-5 rounded-full"
      />
    </div>
  );
}
