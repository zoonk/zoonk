import { Label } from "@zoonk/ui/components/label";
import { NativeSelect } from "@zoonk/ui/components/native-select";

type SelectOption = { label: string; value: string };

/**
 * A form's native select with its label over it.
 */
export function LabeledSelect({
  defaultValue,
  disabled,
  form,
  id,
  label,
  name,
  options,
  triggerClassName,
}: {
  defaultValue: string;
  disabled?: boolean;
  /** The form it belongs to, when it sits outside it. */
  form?: string;
  id: string;
  label: string;
  name: string;
  options: readonly SelectOption[];
  triggerClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect
        className={`${triggerClassName ?? ""} **:data-[slot=native-select]:bg-background`}
        defaultValue={defaultValue}
        disabled={disabled}
        form={form}
        id={id}
        name={name}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
