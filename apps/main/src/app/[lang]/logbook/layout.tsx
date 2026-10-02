import { ClientMessagesProvider } from "@/i18n/client-messages-provider";

/** Learn screens render here, so their client components get the learn catalog. */
export default function Layout({ children }: LayoutProps<"/[lang]/logbook">) {
  return <ClientMessagesProvider scope="learn">{children}</ClientMessagesProvider>;
}
