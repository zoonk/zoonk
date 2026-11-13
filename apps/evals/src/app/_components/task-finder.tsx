"use client";

import { PROSE_MEASURE_CLASS } from "@/lib/table-classes";
import { Input } from "@zoonk/ui/components/input";
import { cn } from "@zoonk/ui/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type TaskFinderTask = {
  description: string;
  id: string;
  name: string;
  scoredModels?: number;
};

export type TaskFinderGroup = { name: string; tasks: TaskFinderTask[] };

function includesEvery(text: string, words: string[]): boolean {
  const lowered = text.toLowerCase();

  return words.every((word) => lowered.includes(word));
}

/** Tasks whose name or id matches come before those only their description matches. */
function searchTasks(groups: TaskFinderGroup[], words: string[]): TaskFinderTask[] {
  const tasks = groups.flatMap((group) => group.tasks);
  const named = tasks.filter((task) => includesEvery(`${task.name} ${task.id}`, words));

  const described = tasks.filter(
    (task) =>
      !named.includes(task) && includesEvery(`${task.name} ${task.id} ${task.description}`, words),
  );

  return [...named, ...described];
}

function ScoredModels({ count }: { count?: number }) {
  if (count === undefined) {
    return null;
  }

  return (
    <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
      {count === 0 ? "No results" : `${count} ${count === 1 ? "model" : "models"}`}
    </span>
  );
}

function TaskRow({ showDescription, task }: { showDescription: boolean; task: TaskFinderTask }) {
  return (
    <li>
      <Link
        className="hover:bg-muted -mx-2.5 flex min-h-11 items-center justify-between gap-4 rounded-lg px-2.5 py-2 text-sm"
        href={`/tasks/${task.id}`}
        title={showDescription ? undefined : task.description}
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-medium">{task.name}</span>
          {showDescription && (
            <span className={cn("text-muted-foreground", PROSE_MEASURE_CLASS)}>
              {task.description}
            </span>
          )}
        </span>

        <ScoredModels count={task.scoredModels} />
      </Link>
    </li>
  );
}

export function TaskFinder({ groups }: { groups: TaskFinderGroup[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const words = query.toLowerCase().split(/\s+/u).filter(Boolean);
  const isSearching = words.length > 0;

  const found = isSearching ? searchTasks(groups, words) : [];

  return (
    <div className="flex flex-col gap-8">
      <form
        onSubmit={(event) => {
          event.preventDefault();

          if (found[0]) {
            router.push(`/tasks/${found[0].id}`);
          }
        }}
        role="search"
      >
        <Input
          aria-label="Find a task"
          autoFocus
          className="max-w-md [&::-webkit-search-cancel-button]:appearance-none"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find a task…"
          type="search"
          value={query}
        />
      </form>

      {isSearching && found.length === 0 && (
        <p className="text-muted-foreground text-sm">No task matches “{query.trim()}”.</p>
      )}

      {isSearching && found.length > 0 && (
        <ul className="flex flex-col">
          {found.map((task) => (
            <TaskRow key={task.id} showDescription task={task} />
          ))}
        </ul>
      )}

      {!isSearching &&
        groups.map((group) => (
          <section className="flex flex-col gap-1" key={group.name}>
            <h2 className="text-muted-foreground text-xs font-medium">{group.name}</h2>

            <ul className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
              {group.tasks.map((task) => (
                <TaskRow key={task.id} showDescription={false} task={task} />
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}
