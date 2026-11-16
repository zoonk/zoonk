import { MainDocumentLink } from "@/components/main-document-link";
import { NOT_FOUND_ICON, getNotFoundWords } from "@/components/public/not-found-message";
import { TaskFrame } from "@zoonk/learn/task-frame";
import { TaskActions, TaskStopMessage } from "@zoonk/learn/task-layout";
import { MainLearnProvider } from "./main-learn-provider";

/** A task's link that leads nowhere, in the task's own frame: its ✕ and its bar both leave for the home page. */
export async function TaskNotFound() {
  const words = await getNotFoundWords();

  return (
    <MainLearnProvider>
      <TaskFrame
        exitHref="/"
        exitToApp
        footer={
          <TaskActions>
            <MainDocumentLink href="/">{words.home}</MainDocumentLink>
          </TaskActions>
        }
      >
        <div className="flex flex-1 flex-col gap-6 pt-4 pb-8">
          <TaskStopMessage
            description={words.description}
            heading="h1"
            icon={NOT_FOUND_ICON}
            title={words.title}
          />
        </div>
      </TaskFrame>
    </MainLearnProvider>
  );
}
