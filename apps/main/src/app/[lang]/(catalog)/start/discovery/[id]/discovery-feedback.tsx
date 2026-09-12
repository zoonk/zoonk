"use client";

import { Link } from "@/i18n/navigation";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";

export function DiscoveryStatusMessage({ status }: { status: string }) {
  const t = useExtracted();

  if (status === "limitReached") {
    return t("You've made many requests today. Your answers are saved; please come back later.");
  }

  if (status === "completed") {
    return t("You've finished this learning path. You can revisit it in My courses.");
  }

  if (status === "unauthorized") {
    return t("Sign in again to continue with your saved answers.");
  }

  if (status === "notFound") {
    return t("This learning request is no longer available.");
  }

  if (status === "refreshed") {
    return t("Your learning request changed in another tab. We’ve loaded the latest version.");
  }

  if (status === "conflict") {
    return t("This question changed in another tab. Refresh to continue.");
  }

  return t("We couldn't prepare your next step. Your saved answers are still here.");
}

export function DiscoveryFeedback({
  discoveryId,
  onRetry,
  status,
}: {
  discoveryId: string;
  onRetry: () => void;
  status: string;
}) {
  const t = useExtracted();

  return (
    <div
      className="flex flex-col gap-3"
      role={status === "completed" || status === "refreshed" ? "status" : "alert"}
    >
      <p className="text-muted-foreground text-sm">
        <DiscoveryStatusMessage status={status} />
      </p>
      {status === "unauthorized" && (
        <Link
          className={buttonVariants({ className: "w-fit" })}
          href={`/login?next=${encodeURIComponent(`/start/discovery/${discoveryId}`)}`}
        >
          {t("Sign in")}
        </Link>
      )}
      {status === "connection" && (
        <Button className="w-fit" onClick={onRetry} variant="outline">
          {t("Try again")}
        </Button>
      )}
      {status === "completed" && (
        <Link className={buttonVariants({ className: "w-fit" })} href="/my">
          {t("My Courses")}
        </Link>
      )}
    </div>
  );
}
