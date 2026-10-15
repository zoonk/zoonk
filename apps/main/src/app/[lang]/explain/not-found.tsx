import { RouteNotFoundFallback } from "@/components/errors/route-not-found-context";

/** A link to this task that leads nowhere says so in the task's frame (see `TaskNotFound`). */
export default function NotFound() {
  return <RouteNotFoundFallback />;
}
