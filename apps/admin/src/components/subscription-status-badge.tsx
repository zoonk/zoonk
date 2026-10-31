import { Badge } from "@zoonk/ui/components/badge";
import { type ComponentProps } from "react";

type SubscriptionStatusBadgeProps = Omit<ComponentProps<typeof Badge>, "variant"> & {
  status: string | null;
};

export function SubscriptionStatusBadge({ status, ...props }: SubscriptionStatusBadgeProps) {
  return <Badge variant={getSubscriptionStatusBadgeVariant(status)} {...props} />;
}

function getSubscriptionStatusBadgeVariant(status: string | null) {
  if (status === "active" || status === "trialing") {
    return "success" as const;
  }

  if (
    status === "canceled" ||
    status === "incomplete_expired" ||
    status === "past_due" ||
    status === "unpaid"
  ) {
    return "destructive" as const;
  }

  return "secondary" as const;
}
