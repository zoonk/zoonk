import { RouteNotFoundProvider } from "@/components/errors/route-not-found-context";
import { TaskNotFound } from "@/components/learn/task-not-found";
import { ClientMessagesProvider } from "@/i18n/client-messages-provider";

export default function Layout({ children }: LayoutProps<"/[lang]/explain">) {
  return (
    <ClientMessagesProvider scope="learn">
      <RouteNotFoundProvider fallback={<TaskNotFound />}>{children}</RouteNotFoundProvider>
    </ClientMessagesProvider>
  );
}
