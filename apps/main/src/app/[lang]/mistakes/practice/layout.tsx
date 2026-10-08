import { ClientMessagesProvider } from "@/i18n/client-messages-provider";

/** The practice run renders learn screens, so its client components get the learn catalog. */
export default function Layout({ children }: LayoutProps<"/[lang]/mistakes/practice">) {
  return <ClientMessagesProvider scope="learn">{children}</ClientMessagesProvider>;
}
