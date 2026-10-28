import { RouteNotFoundProvider } from "@/components/errors/route-not-found-context";
import { TaskNotFound } from "@/components/learn/task-not-found";
import { ClientMessagesProvider } from "@/i18n/client-messages-provider";

/**
 * Learn screens render here, and a finished mock's "Ask" opens the player's questions sheet, so
 * client components get the learn catalog (which includes the player's).
 */
export default function Layout({ children }: LayoutProps<"/[lang]/mock">) {
  return (
    <ClientMessagesProvider scope="learn">
      <RouteNotFoundProvider fallback={<TaskNotFound />}>{children}</RouteNotFoundProvider>
    </ClientMessagesProvider>
  );
}
