"use cache";

import { notFound } from "next/navigation";
import { TASKS } from "@/tasks";
import { TaskPageClient } from "./task-page-client";

interface TaskPageProps {
  params: Promise<{ taskId: string }>;
}

export default async function TaskPage({ params }: TaskPageProps) {
  const { taskId } = await params;
  const task = TASKS.find((t) => t.id === taskId);

  if (!task) {
    notFound();
  }

  return <TaskPageClient taskId={task.id} taskName={task.name} />;
}
