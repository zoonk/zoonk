export function VisitorLook({ children }: { children: React.ReactNode }) {
  return <div className="signed-in:hidden contents">{children}</div>;
}
