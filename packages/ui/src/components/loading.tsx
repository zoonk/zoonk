export function FullPageLoading() {
  return (
    <div
      aria-busy="true"
      className="fixed inset-0 flex items-center justify-center bg-background"
    >
      <div
        aria-hidden="true"
        className="inset-0 size-5 animate-[breathe_2s_ease-in-out_infinite] rounded-full bg-foreground/80"
      />
    </div>
  );
}
