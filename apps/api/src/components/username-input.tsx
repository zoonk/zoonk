import { Input } from "@zoonk/ui/components/input";
import { cn } from "@zoonk/ui/lib/utils";

export function UsernameInput({ className, onChange, ...props }: React.ComponentProps<"input">) {
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm"
      >
        @
      </span>

      <Input
        autoCapitalize="none"
        autoCorrect="off"
        className={cn("pl-7", className)}
        maxLength={30}
        minLength={3}
        onChange={(event) => {
          event.target.value = event.target.value.toLowerCase();
          onChange?.(event);
        }}
        required
        spellCheck={false}
        {...props}
      />
    </div>
  );
}
