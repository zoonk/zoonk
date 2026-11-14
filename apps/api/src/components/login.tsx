import {
  AppleBrandIcon,
  type BrandIconComponent,
  GoogleBrandIcon,
} from "@zoonk/ui/components/brand-icons";
import { Button } from "@zoonk/ui/components/button";
import { Input } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import { cn } from "@zoonk/ui/lib/utils";

export function Login({ children, className }: React.ComponentProps<"div">) {
  return <div className={cn("flex w-full flex-col gap-6", className)}>{children}</div>;
}

export function LoginDivider({ children, className }: React.ComponentProps<"div">) {
  return (
    <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
      <span className={cn("bg-background text-muted-foreground relative z-10 px-2", className)}>
        {children}
      </span>
    </div>
  );
}

export function LoginSocial({ children, className }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-2", className)}>{children}</div>;
}

type LoginWithProviderProps = React.ComponentProps<"button"> & {
  isLoading?: boolean;
  icon?: BrandIconComponent;
};

function LoginWithProvider({
  children,
  className,
  icon: Icon,
  isLoading,
  ...props
}: LoginWithProviderProps) {
  return (
    <Button
      busy={isLoading ?? false}
      className={cn("w-full", className)}
      icon={Icon && <Icon aria-hidden="true" />}
      size="lg"
      variant="outline"
      {...props}
    >
      {children}
    </Button>
  );
}

export function LoginWithGoogle({ children, ...props }: LoginWithProviderProps) {
  return (
    <LoginWithProvider icon={GoogleBrandIcon} {...props}>
      {children}
    </LoginWithProvider>
  );
}

export function LoginWithApple({ children, ...props }: LoginWithProviderProps) {
  return (
    <LoginWithProvider icon={AppleBrandIcon} {...props}>
      {children}
    </LoginWithProvider>
  );
}

export function LoginEmailLabel({ children, ...props }: React.ComponentProps<"label">) {
  return (
    <Label htmlFor="email" {...props}>
      {children}
    </Label>
  );
}

export function LoginEmailInput({ ...props }: React.ComponentProps<"input">) {
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

export function LoginFooter({ children, className }: React.ComponentProps<"footer">) {
  return (
    <footer
      className={cn(
        "text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4",
        className,
      )}
    >
      {children}
    </footer>
  );
}
