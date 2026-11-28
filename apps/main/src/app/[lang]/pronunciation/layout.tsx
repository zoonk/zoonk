import { RouteNotFoundProvider } from "@/components/errors/route-not-found-context";
import { TaskNotFound } from "@/components/learn/task-not-found";
import { LearnerClock } from "@/components/learner/learner-clock";
import { ClientMessagesProvider } from "@/i18n/client-messages-provider";

export default function Layout({ children }: LayoutProps<"/[lang]/pronunciation">) {
  return (
    <ClientMessagesProvider scope="learn">
      <LearnerClock>
        <RouteNotFoundProvider fallback={<TaskNotFound />}>{children}</RouteNotFoundProvider>
      </LearnerClock>
    </ClientMessagesProvider>
  );
}
