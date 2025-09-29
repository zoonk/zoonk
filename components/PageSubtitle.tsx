interface PageSubtitleProps {
  children: React.ReactNode;
}

export const PageSubtitle = ({ children }: PageSubtitleProps) => (
  <h2 className="text-secondary-foreground/90">{children}</h2>
);
