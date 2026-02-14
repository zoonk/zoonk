import { Input, InputError } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import { cn } from "@zoonk/ui/lib/utils";
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";

export function Setup({ children, className }: React.ComponentProps<"div">) {
  return <div className={cn("flex w-full flex-col gap-6 p-4", className)}>{children}</div>;
}

export function SetupHeader({ children, className }: React.ComponentProps<"header">) {
  return <header className={cn("flex flex-col items-center gap-2", className)}>{children}</header>;
}

export function SetupTitle({ children, className }: React.ComponentProps<"h1">) {
  return <h1 className={cn("text-xl font-bold", className)}>{children}</h1>;
}

export function SetupDescription({ children, className }: React.ComponentProps<"p">) {
  return <p className={cn("text-center text-sm text-balance", className)}>{children}</p>;
}

export function SetupForm({ children, className, ...props }: React.ComponentProps<"form">) {
  return (
    <form className={cn("flex flex-col gap-4", className)} {...props}>
      {children}
    </form>
  );
}

export function SetupField({ children, className }: React.ComponentProps<"fieldset">) {
  return <fieldset className={cn("grid gap-3", className)}>{children}</fieldset>;
}

export function SetupLabel({ children, ...props }: React.ComponentProps<"label">) {
  return <Label {...props}>{children}</Label>;
}

export function SetupInput({ ...props }: React.ComponentProps<"input">) {
  return <Input required {...props} />;
}

export function SetupError({
  children,
  hasError,
  ...props
}: React.ComponentProps<"p"> & { hasError: boolean }) {
  if (!hasError) {
    return null;
  }

  return <InputError {...props}>{children}</InputError>;
}

export function SetupSubmit({ children, ...props }: React.ComponentProps<"button">) {
  return (
    <SubmitButton full {...props}>
      {children}
    </SubmitButton>
  );
}
