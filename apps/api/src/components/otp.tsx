import {
  InputOTP,
  InputOTPGroup,
  type InputOTPProps,
  InputOTPSlot,
} from "@zoonk/ui/components/input-otp";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";

export function OTP({ children, className }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex w-full flex-col items-center gap-6 text-center", className)}>
      {children}
    </div>
  );
}

export function OTPDescriptionSkeleton() {
  return <Skeleton className="h-5 w-60 max-w-full rounded-md" />;
}

export function OTPActions({ children, className }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex w-full flex-col items-stretch gap-2", className)}>{children}</div>
  );
}

export function OTPLinks({ children, className }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "text-muted-foreground mt-2 flex flex-wrap items-center justify-center gap-x-1 text-sm",
        className,
      )}
    >
      {children}
    </p>
  );
}

export const OTP_LINK_CLASS =
  "text-foreground focus-visible:ring-ring/50 inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] aria-disabled:pointer-events-none aria-disabled:opacity-50";

function keepDigits(text: string) {
  return text.replaceAll(/\D/gu, "");
}

export const OTP_LENGTH = 6;

export function OTPFormSkeleton() {
  return (
    <div aria-hidden="true" className="flex w-full flex-col items-center gap-2">
      <div className="flex justify-center gap-2">
        {Array.from({ length: OTP_LENGTH }, (_, index) => (
          <Skeleton className="h-13 w-12 rounded-lg" key={index} />
        ))}
      </div>

      <div className="h-5" />
      <Skeleton className="h-11 w-full rounded-lg" />
      <Skeleton className="mt-2 mb-3 h-5 w-52 rounded-md" />
    </div>
  );
}

export function OTPInput({ ...props }: Partial<Omit<InputOTPProps, "render">>) {
  return (
    <InputOTP
      containerClassName="justify-center gap-3"
      maxLength={OTP_LENGTH}
      name="otp"
      pasteTransformer={keepDigits}
      pattern="[0-9]*"
      required
      {...props}
    >
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
        <InputOTPSlot index={3} />
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>
  );
}
