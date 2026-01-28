import { Button } from "@zoonk/ui/components/button";
import { InputError } from "@zoonk/ui/components/input";
import {
  InputOTP,
  InputOTPGroup,
  type InputOTPProps,
  InputOTPSeparator,
  InputOTPSlot,
} from "@zoonk/ui/components/input-otp";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";

export function OTP({ children, className }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex w-full flex-col items-center gap-6 text-center", className)}>
      {children}
    </div>
  );
}

export function OTPHeader({ children, className }: React.ComponentProps<"header">) {
  return <header className={cn("flex flex-col items-center gap-2", className)}>{children}</header>;
}

export function OTPTitle({ children, className }: React.ComponentProps<"h1">) {
  return <h1 className={cn("text-xl font-bold", className)}>{children}</h1>;
}

export function OTPDescription({ children, className }: React.ComponentProps<"p">) {
  return <p className={cn("text-center text-sm text-balance", className)}>{children}</p>;
}

export function OTPForm({ children, className, ...props }: React.ComponentProps<"form">) {
  return (
    <form className={cn("flex flex-col items-center gap-4", className)} {...props}>
      {children}
    </form>
  );
}

export function OTPInput({ ...props }: Partial<Omit<InputOTPProps, "render">>) {
  return (
    <InputOTP maxLength={6} name="otp" pattern="[0-9]*" required {...props}>
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        <InputOTPSlot index={3} />
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>
  );
}

export function OTPError({
  children,
  hasError,
  ...props
}: React.ComponentProps<"div"> & { hasError?: boolean }) {
  if (!hasError) {
    return null;
  }

  return <InputError {...props}>{children}</InputError>;
}

export function OTPSubmit({
  children,
  isLoading,
  ...props
}: React.ComponentProps<"button"> & { isLoading?: boolean }) {
  return (
    <Button disabled={isLoading} type="submit" {...props}>
      {isLoading && <Spinner />}
      {children}
    </Button>
  );
}
