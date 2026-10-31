"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { OTPInput, OTPInputContext } from "input-otp";
import { useContext } from "react";

type InputOTPProps = React.ComponentProps<typeof OTPInput> & { containerClassName?: string };

function InputOTP({ className, containerClassName, ...props }: InputOTPProps) {
  return (
    <OTPInput
      className={cn("disabled:cursor-not-allowed", className)}
      containerClassName={cn(
        "cn-input-otp flex w-full items-center gap-2 has-disabled:opacity-50",
        containerClassName,
      )}
      data-slot="input-otp"
      spellCheck={false}
      {...props}
    />
  );
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-w-0 items-center gap-2", className)}
      data-slot="input-otp-group"
      {...props}
    />
  );
}

function InputOTPSlot({
  index,
  className,
  ...props
}: React.ComponentProps<"div"> & { index: number }) {
  const inputOTPContext = useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = inputOTPContext?.slots[index] ?? {};

  return (
    <div
      className={cn(
        "border-input bg-background aria-invalid:border-destructive data-[active=true]:border-foreground/40 relative flex h-13 w-12 min-w-0 items-center justify-center rounded-lg border font-mono text-xl tabular-nums transition-[border-color] outline-none motion-reduce:transition-none",
        className,
      )}
      data-active={isActive}
      data-slot="input-otp-slot"
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="animate-caret-blink bg-foreground h-5 w-px duration-1000" />
        </div>
      )}
    </div>
  );
}

export { InputOTP, InputOTPGroup, InputOTPSlot, type InputOTPProps };
