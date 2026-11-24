import { ScrubInput } from "@shift/ui";

interface SettingsNumberFieldProps {
  value: number | null;
  onValueChange: (value: number | null) => void;
  onValueCommitted: () => Promise<void>;
  ariaLabel: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
}

/**
 * A numeric settings field: drag it sideways to scrub, or click to type a
 * number or a sum such as `600+20`. Each commit, typed or once per scrub,
 * updates the draft and saves it.
 */
export const SettingsNumberField = ({
  value,
  onValueChange,
  onValueCommitted,
  ariaLabel,
  className,
  inputClassName,
  disabled,
}: SettingsNumberFieldProps) => {
  const commit = async (next: number | null) => {
    onValueChange(next);
    await onValueCommitted();
  };

  return (
    <ScrubInput
      aria-label={ariaLabel}
      value={value}
      onValueCommit={commit}
      onClear={() => commit(null)}
      tooltip={false}
      maximumFractionDigits={4}
      size="md"
      disabled={disabled}
      className={className}
      inputClassName={inputClassName}
    />
  );
};
