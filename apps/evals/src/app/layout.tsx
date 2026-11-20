import { FRAME_GUTTER_CLASS } from "@zoonk/ui/components/bottom-bar";
import { Container } from "@zoonk/ui/components/container";
import { FONT_VARIABLES } from "@zoonk/ui/fonts";
import { cn } from "@zoonk/ui/lib/utils";
import { type Metadata } from "next";
import "@zoonk/ui/globals.css";

export const metadata: Metadata = { title: { default: "Evals", template: "%s | Evals" } };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html className={FONT_VARIABLES} lang="en">
      <body className="font-sans antialiased">
        <Container
          className={cn("[--page-bottom:3rem] lg:[--page-bottom:4rem]", FRAME_GUTTER_CLASS)}
        >
          {children}
        </Container>
      </body>
    </html>
  );
}
