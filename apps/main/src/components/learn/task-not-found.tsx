import { NotFoundMessage } from "@/components/public/not-found-message";
import { TaskFrame } from "@zoonk/learn/task-frame";
import { MainLearnProvider } from "./main-learn-provider";

export function TaskNotFound() {
  return (
    <MainLearnProvider>
      <TaskFrame exitHref="/" exitToApp>
        <NotFoundMessage />
      </TaskFrame>
    </MainLearnProvider>
  );
}
