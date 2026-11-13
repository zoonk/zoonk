import { Container } from "@zoonk/ui/components/container";
import { FONT_VARIABLES } from "@zoonk/ui/fonts";
import { type Metadata } from "next";
import "@zoonk/ui/globals.css";

export const metadata: Metadata = { title: { default: "Evals", template: "%s | Evals" } };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html className={FONT_VARIABLES} lang="en">
      <body className="font-sans antialiased">
        <Container>{children}</Container>
      </body>
    </html>
  );
}
