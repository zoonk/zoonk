import { geistMono, geistSans } from "@/lib/fonts";
import { type Metadata } from "next";
import "@zoonk/ui/globals.css";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: { default: "Zoonk Playground", template: "%s | Zoonk Playground" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html className={`${geistSans.variable} ${geistMono.variable}`} lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
