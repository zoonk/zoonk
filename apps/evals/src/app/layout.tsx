import { Container } from "@zoonk/ui/components/container";
import "@zoonk/ui/globals.css";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Container>{children}</Container>
      </body>
    </html>
  );
}
