import { ClientMessagesProvider } from "@/i18n/client-messages-provider";

export default function Layout({ children }: LayoutProps<"/[lang]/focus-test">) {
  return <ClientMessagesProvider scope="learn">{children}</ClientMessagesProvider>;
}
