import {
  Protected,
  ProtectedAlert,
  ProtectedAlertActions,
  ProtectedAlertHeader,
  ProtectedAlertTitle,
  ProtectedPending,
  ProtectedPendingMedia,
  ProtectedPendingTitle,
} from "@zoonk/ui/components/protected";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";
import { LockIcon } from "lucide-react";

type ProtectedSectionProps = {
  state: "pending" | "unauthenticated" | "authenticated";
  pendingTitle?: string;
  alertTitle: string;
  actions?: React.ReactNode;
  centered?: boolean;
} & React.ComponentProps<"section">;

export function ProtectedSection({
  state,
  pendingTitle,
  alertTitle,
  actions,
  children,
  centered,
  ...props
}: ProtectedSectionProps) {
  if (state === "pending") {
    return (
      <ProtectedPending>
        <ProtectedPendingMedia>
          <Spinner />
        </ProtectedPendingMedia>

        {pendingTitle && <ProtectedPendingTitle>{pendingTitle}</ProtectedPendingTitle>}
      </ProtectedPending>
    );
  }

  if (state === "unauthenticated") {
    return (
      <ProtectedAlert
        className={cn({
          "mx-auto items-center text-center": centered,
        })}
      >
        <ProtectedAlertHeader>
          <LockIcon />
          <ProtectedAlertTitle>{alertTitle}</ProtectedAlertTitle>
        </ProtectedAlertHeader>

        <ProtectedAlertActions>{actions}</ProtectedAlertActions>
      </ProtectedAlert>
    );
  }

  return <Protected {...props}>{children}</Protected>;
}
