import { SidebarStateScript } from "@zoonk/ui/components/sidebar";
import { type Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Zoonk Admin", template: "%s | Zoonk Admin" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The sidebar script marks `<html>` before React hydrates it.
    <html lang="en" suppressHydrationWarning>
      <head>
        <SidebarStateScript />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
