import { RouteNotFoundProvider } from "@/components/errors/route-not-found-context";
import { TaskNotFound } from "@/components/learn/task-not-found";
import { ClientMessagesProvider } from "@/i18n/client-messages-provider";

/** Learn screens render here, so their client components get the learn catalog. */
export default function Layout({ children }: LayoutProps<"/[lang]/conversation">) {
  return (
    <ClientMessagesProvider scope="learn">
      <RouteNotFoundProvider fallback={<TaskNotFound />}>{children}</RouteNotFoundProvider>
    </ClientMessagesProvider>
  );
}
