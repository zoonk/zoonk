import "@zoonk/ui/globals.css";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@zoonk/ui/components/card";
import Link from "next/link";
import { TASKS } from "@/tasks";

export default function Home() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl">Evals Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Run and monitor evaluations for AI tasks
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {TASKS.map((task) => (
          <Link key={task.id} href={`/tasks/${task.id}` as `/tasks/${string}`}>
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardTitle>{task.name}</CardTitle>
                <CardDescription>{task.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  {task.testCases.length} test cases
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
