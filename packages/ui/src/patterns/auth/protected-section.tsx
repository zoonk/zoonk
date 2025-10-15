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
import { LockIcon } from "lucide-react";

type ProtectedSectionProps = {
  state: "pending" | "unauthenticated" | "authenticated";
  pendingTitle: string;
  alertTitle: string;
  actions?: React.ReactNode;
} & React.ComponentProps<"section">;

export function ProtectedSection({
  state,
  pendingTitle,
  alertTitle,
  actions,
  children,
  ...props
}: ProtectedSectionProps) {
  if (state === "pending") {
    return (
      <ProtectedPending>
        <ProtectedPendingMedia>
          <Spinner />
        </ProtectedPendingMedia>

        <ProtectedPendingTitle>{pendingTitle}</ProtectedPendingTitle>
      </ProtectedPending>
    );
  }

  if (state === "unauthenticated") {
    return (
      <ProtectedAlert>
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
