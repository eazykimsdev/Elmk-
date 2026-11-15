import * as React from 'react';
import { cn } from '@/lib/utils';

export interface NumberFieldProps {
  id?: string;
  name?: string;
  value?: number | null;
  onChange?: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  'aria-label'?: string;
}

/**
 * Reusable <NumberField> for ConnectingERLC platform.
 * - Hides native spin arrows everywhere.
 * - Keeps value as a string while typing so the box can be cleared and retyped.
 * - Accepts only digits.
 * - Parses and clamps on blur: below min becomes min, above max becomes max.
 * - Restores last valid value if left empty on blur.
 * - Supports ArrowUp / ArrowDown keyboard increment/decrement.
 * - Right-aligned input, inline suffix in muted text.
 */
export function NumberField({
  id,
  name,
  value,
  onChange,
  min = 0,
  max = 100000,
  step = 1,
  suffix,
  error,
  disabled = false,
  className,
  placeholder,
  'aria-label': ariaLabel,
}: NumberFieldProps) {
  // Normalize incoming value to a valid number
  const safeInitial = typeof value === 'number' && !isNaN(value) ? Math.max(min, Math.min(max, value)) : min;

  // Local string buffer while user is actively typing
  const [textValue, setTextValue] = React.useState<string>(String(safeInitial));
  const [isFocused, setIsFocused] = React.useState(false);
  const lastValidRef = React.useRef<number>(safeInitial);

  // Sync with external value changes when not actively focused
  React.useEffect(() => {
    if (!isFocused) {
      const valid = typeof value === 'number' && !isNaN(value) ? Math.max(min, Math.min(max, value)) : min;
      lastValidRef.current = valid;
      setTextValue(String(valid));
    }
  }, [value, min, max, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow empty string while typing so the user can backspace completely
    if (raw === '') {
      setTextValue('');
      return;
    }
    // Only accept digits
    const digitsOnly = raw.replace(/[^0-9]/g, '');
    setTextValue(digitsOnly);
  };

  const commitValue = (valStr: string) => {
    if (valStr === '' || valStr.trim() === '') {
      // If box is left empty on blur, restore the last valid value
      const restored = lastValidRef.current;
      setTextValue(String(restored));
      onChange?.(restored);
      return;
    }

    let parsed = parseInt(valStr, 10);
    if (isNaN(parsed)) {
      parsed = lastValidRef.current;
    }

    // Clamp between min and max
    const clamped = Math.max(min, Math.min(max, parsed));
    lastValidRef.current = clamped;
    setTextValue(String(clamped));
    onChange?.(clamped);
  };

  const handleBlur = () => {
    setIsFocused(false);
    commitValue(textValue);
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const current = parseInt(textValue, 10) || min;
      const next = Math.min(max, current + step);
      lastValidRef.current = next;
      setTextValue(String(next));
      onChange?.(next);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const current = parseInt(textValue, 10) || min;
      const next = Math.max(min, current - step);
      lastValidRef.current = next;
      setTextValue(String(next));
      onChange?.(next);
    } else if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <div className="inline-flex flex-col gap-1">
      <div
        className={cn(
          'relative inline-flex items-center h-10 w-[120px] rounded-[10px] bg-[#141417] border border-[rgba(255,255,255,0.07)] px-2.5 transition-colors focus-within:border-[rgba(255,255,255,0.25)] focus-within:ring-1 focus-within:ring-[var(--accent)]/40',
          disabled && 'opacity-50 cursor-not-allowed',
          error && 'border-rose-500/50 focus-within:border-rose-500',
          className
        )}
      >
        <input
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={textValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className="w-full flex-1 min-w-0 bg-transparent text-right text-[14px] text-[#F4F4F5] font-sans font-medium outline-none pr-1.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        {suffix && (
          <span className="text-[13px] text-[#71717A] select-none font-sans whitespace-nowrap pl-0.5 shrink-0">
            {suffix}
          </span>
        )}
      </div>
      {error && (
        <span className="text-[11px] text-rose-400 font-sans leading-none">
          {error}
        </span>
      )}
    </div>
  );
}

