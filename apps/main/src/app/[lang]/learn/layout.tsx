import { ClientMessagesProvider } from "@/i18n/client-messages-provider";

/** The lesson player renders here, so its client components get the player and learn catalogs. */
export default function Layout({ children }: LayoutProps<"/[lang]/learn">) {
  return <ClientMessagesProvider scope="player">{children}</ClientMessagesProvider>;
}
