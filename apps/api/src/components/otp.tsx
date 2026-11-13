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

/** The six boxes share the column's width, so they start and end where the field and Continue do. */
const OTP_SLOT_CLASS = "h-11 w-auto flex-1";

export function OTPFormSkeleton() {
  return (
    <div aria-hidden="true" className="flex w-full flex-col items-center gap-2">
      <div className="flex w-full gap-2">
        {Array.from({ length: OTP_LENGTH }, (_, index) => (
          <Skeleton className={cn(OTP_SLOT_CLASS, "rounded-lg")} key={index} />
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
      containerClassName="gap-3"
      maxLength={OTP_LENGTH}
      name="otp"
      pasteTransformer={keepDigits}
      pattern="[0-9]*"
      required
      {...props}
    >
      <InputOTPGroup className="w-full">
        <InputOTPSlot className={OTP_SLOT_CLASS} index={0} />
        <InputOTPSlot className={OTP_SLOT_CLASS} index={1} />
        <InputOTPSlot className={OTP_SLOT_CLASS} index={2} />
        <InputOTPSlot className={OTP_SLOT_CLASS} index={3} />
        <InputOTPSlot className={OTP_SLOT_CLASS} index={4} />
        <InputOTPSlot className={OTP_SLOT_CLASS} index={5} />
      </InputOTPGroup>
    </InputOTP>
  );
}
