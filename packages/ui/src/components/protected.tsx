import { cn } from "../lib/utils";
import { Alert, type AlertProps, AlertTitle } from "./alert";
import {
  Item,
  ItemContent,
  ItemMedia,
  type ItemMediaProps,
  type ItemProps,
  ItemTitle,
} from "./item";

function Protected({ children, ...props }: React.ComponentProps<"section">) {
  return (
    <section data-slot="protected" {...props}>
      {children}
    </section>
  );
}

function ProtectedPending({ children, ...props }: ItemProps) {
  return <Item {...props}>{children}</Item>;
}

function ProtectedPendingMedia({ children, ...props }: ItemMediaProps) {
  return <ItemMedia {...props}>{children}</ItemMedia>;
}

function ProtectedPendingTitle({
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <ItemContent>
      <ItemTitle {...props}>{children}</ItemTitle>
    </ItemContent>
  );
}

function ProtectedAlert({
  children,
  className,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      className={cn("flex max-w-md flex-col gap-4", className)}
      data-slot="protected-alert"
      {...props}
    >
      {children}
    </section>
  );
}

function ProtectedAlertHeader({ children, className, ...props }: AlertProps) {
  return (
    <Alert className={cn("max-w-sm", className)} {...props}>
      {children}
    </Alert>
  );
}

function ProtectedAlertTitle({
  children,
  ...props
}: React.ComponentProps<"div">) {
  return <AlertTitle {...props}>{children}</AlertTitle>;
}

function ProtectedAlertActions({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex gap-2", className)} {...props}>
      {children}
    </div>
  );
}

export {
  Protected,
  ProtectedPending,
  ProtectedPendingMedia,
  ProtectedPendingTitle,
  ProtectedAlert,
  ProtectedAlertHeader,
  ProtectedAlertTitle,
  ProtectedAlertActions,
};
