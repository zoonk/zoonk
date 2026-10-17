import { NotFoundMessage } from "@/components/public/not-found-message";
import { TaskFrame } from "@zoonk/learn/task-frame";
import { MainLearnProvider } from "./main-learn-provider";

/**
 * A task that isn't there (a lesson, a mock or a checkpoint from an old link) says so in the
 * task's own frame, where its loading screen already drew the ✕, instead of swapping the screen
 * for the public site's header and footer. Leaving goes back to the app page it was opened from,
 * else home, which is Today for a learner. Each task route's `not-found.tsx` shows it.
 */
export function TaskNotFound() {
  return (
    <MainLearnProvider>
      <TaskFrame exitHref="/" exitToApp>
        <NotFoundMessage />
      </TaskFrame>
    </MainLearnProvider>
  );
}
