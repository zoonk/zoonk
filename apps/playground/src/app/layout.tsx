import { FONT_VARIABLES } from "@zoonk/ui/fonts";
import { type Metadata, type Viewport } from "next";
import "@zoonk/ui/globals.css";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: { default: "Zoonk Playground", template: "%s | Zoonk Playground" },
};

/** As on main, so a phone's keyboard previews as learners get it. */
export const viewport: Viewport = { interactiveWidget: "resizes-content" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html className={FONT_VARIABLES} lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
