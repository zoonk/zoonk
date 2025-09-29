interface PageTitleProps {
  children: React.ReactNode;
}

export function PageTitle({ children }: PageTitleProps) {
  return (
    <h1 className="font-semibold text-foreground/90 text-xl">{children}</h1>
  );
}
