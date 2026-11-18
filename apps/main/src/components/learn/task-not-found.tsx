import { MainDocumentLink } from "@/components/main-document-link";
import { NOT_FOUND_ICON, getNotFoundWords } from "@/components/public/not-found-message";
import { TaskFrame } from "@zoonk/learn/task-frame";
import { TaskActions, TaskStopMessage } from "@zoonk/learn/task-layout";
import { MainLearnProvider } from "./main-learn-provider";

export async function TaskNotFound() {
  const words = await getNotFoundWords();

  return (
    <MainLearnProvider>
      <TaskFrame
        exitHref="/today"
        exitToApp
        footer={
          <TaskActions>
            <MainDocumentLink href="/today">{words.today}</MainDocumentLink>
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
