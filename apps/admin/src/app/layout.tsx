import type { Metadata } from "next";
import "@zoonk/ui/globals.css";

export const metadata: Metadata = {
  title: {
    default: "Zoonk Admin",
    template: "%s | Zoonk Admin",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
