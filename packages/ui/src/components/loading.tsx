export function FullPageLoading() {
  return (
    <div aria-busy="true" className="bg-background fixed inset-0 flex items-center justify-center">
      <div
        aria-hidden="true"
        className="bg-foreground/80 animate-breathe inset-0 size-5 rounded-full"
      />
    </div>
  );
}
