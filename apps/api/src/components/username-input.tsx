import { InputGroup, InputGroupAddon, InputGroupInput } from "@zoonk/ui/components/input-group";

export function UsernameInput({ className, onChange, ...props }: React.ComponentProps<"input">) {
  return (
    <InputGroup className={className}>
      <InputGroupAddon>@</InputGroupAddon>

      <InputGroupInput
        autoCapitalize="none"
        autoComplete="username"
        autoCorrect="off"
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
    </InputGroup>
  );
}
