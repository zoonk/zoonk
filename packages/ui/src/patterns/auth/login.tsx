import {
  IconBrandAppleFilled,
  IconBrandGoogleFilled,
  type IconProps,
} from "@tabler/icons-react";
import { Button } from "@zoonk/ui/components/button";
import { Input, InputError } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import { cn } from "@zoonk/ui/lib/utils";
import { Loader2Icon } from "lucide-react";
import { SubmitButton } from "../buttons/submit";

export function LoginNav({ children, className }: React.ComponentProps<"nav">) {
  return <nav className={cn("fixed top-4 left-4", className)}>{children}</nav>;
}

export function Login({ children, className }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-6", className)}>{children}</div>;
}

export function LoginHeader({
  children,
  className,
}: React.ComponentProps<"div">) {
  return (
    <header className={cn("flex flex-col items-center gap-2", className)}>
      {children}
    </header>
  );
}

export function LoginTitle({
  children,
  className,
}: React.ComponentProps<"h1">) {
  return <h1 className={cn("font-bold text-xl", className)}>{children}</h1>;
}

export function LoginDescription({
  children,
  className,
}: React.ComponentProps<"p">) {
  return <p className={cn("text-center text-sm", className)}>{children}</p>;
}

export function LoginDivider({
  children,
  className,
}: React.ComponentProps<"div">) {
  return (
    <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-border after:border-t">
      <span
        className={cn(
          "relative z-10 bg-background px-2 text-muted-foreground",
          className,
        )}
      >
        {children}
      </span>
    </div>
  );
}

export function LoginSocial({
  children,
  className,
}: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-2", className)}>{children}</div>;
}

type LoginWithProviderProps = React.ComponentProps<"button"> & {
  isLoading?: boolean;
  icon?: React.ForwardRefExoticComponent<IconProps>;
};

export function LoginWithProvider({
  children,
  className,
  icon: Icon,
  isLoading,
  ...props
}: LoginWithProviderProps) {
  return (
    <Button
      className={cn("w-full", className)}
      disabled={isLoading}
      variant="outline"
      {...props}
    >
      {isLoading && <Loader2Icon className="animate-spin" />}
      {Icon && <Icon aria-hidden="true" />}
      {children}
    </Button>
  );
}

export function LoginWithGoogle({
  children,
  ...props
}: LoginWithProviderProps) {
  return (
    <LoginWithProvider icon={IconBrandGoogleFilled} {...props}>
      {children}
    </LoginWithProvider>
  );
}

export function LoginWithApple({ children, ...props }: LoginWithProviderProps) {
  return (
    <LoginWithProvider icon={IconBrandAppleFilled} {...props}>
      {children}
    </LoginWithProvider>
  );
}

export function LoginError({ children, ...props }: React.ComponentProps<"p">) {
  return <InputError {...props}>{children}</InputError>;
}

export function LoginForm({
  children,
  className,
  ...props
}: React.ComponentProps<"form">) {
  return (
    <form className={cn("flex flex-col gap-6", className)} {...props}>
      {children}
    </form>
  );
}

export function LoginField({
  children,
  className,
}: React.ComponentProps<"fieldset">) {
  return (
    <fieldset className={cn("grid gap-3", className)}>{children}</fieldset>
  );
}

export function LoginEmailLabel({
  children,
  className,
  ...props
}: React.ComponentProps<"label">) {
  return (
    <Label htmlFor="email" {...props}>
      {children}
    </Label>
  );
}

export function LoginEmailInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <Input
      autoCapitalize="none"
      autoComplete="email"
      id="email"
      name="email"
      required
      spellCheck={false}
      type="email"
      {...props}
    />
  );
}

export function LoginSubmit({
  children,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <SubmitButton full {...props}>
      {children}
    </SubmitButton>
  );
}

export function LoginFooter({
  children,
  className,
}: React.ComponentProps<"footer">) {
  return (
    <footer
      className={cn(
        "text-balance text-center text-muted-foreground text-xs *:[a]:underline *:[a]:underline-offset-4 *:[a]:hover:text-primary",
        className,
      )}
    >
      {children}
    </footer>
  );
}
