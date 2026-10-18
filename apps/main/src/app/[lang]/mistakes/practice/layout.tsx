import { RouteNotFoundProvider } from "@/components/errors/route-not-found-context";
import { TaskNotFound } from "@/components/learn/task-not-found";
import { ClientMessagesProvider } from "@/i18n/client-messages-provider";

/**
 * The practice run renders learn screens and asks the buddy with the player's conversation, so its
 * client components get the player catalog (which includes learn's).
 */
export default function Layout({ children }: LayoutProps<"/[lang]/mistakes/practice">) {
  return (
    <ClientMessagesProvider scope="player">
      <RouteNotFoundProvider fallback={<TaskNotFound />}>{children}</RouteNotFoundProvider>
    </ClientMessagesProvider>
  );
}
