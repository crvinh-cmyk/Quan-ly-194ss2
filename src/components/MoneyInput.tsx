import React, { useState, useEffect } from 'react';
import { numberToVietnameseWords } from '../utils/formatters';

interface MoneyInputProps {
  value: number;
  onChange: (val: number) => void;
  placeholder?: string;
  className?: string;
  showWords?: boolean;
  autoFocus?: boolean;
}

/**
 * Format raw string of digits into comma-separated money display (e.g. 1459000 -> 1,459,000)
 */
function formatWithCommas(raw: string): string {
  // Strip non-digits
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  // Remove leading zeros if not just "0"
  const cleanDigits = digits.replace(/^0+(?=\d)/, '');
  if (!cleanDigits) return '0';
  // Format with commas every 3 digits
  return cleanDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export const MoneyInput: React.FC<MoneyInputProps> = ({
  value,
  onChange,
  placeholder = '0',
  className = '',
  showWords = true,
  autoFocus = false,
}) => {
  // Local string state to allow natural typing of zeros, commas, and editing
  const [textValue, setTextValue] = useState<string>(() => {
    if (value === 0) return '0';
    return value ? value.toLocaleString('en-US') : '';
  });

  // Sync when prop value changes from outside (e.g. modal opens or reset)
  useEffect(() => {
    const currentNum = parseInt(textValue.replace(/\D/g, '') || '0', 10);
    if (value !== currentNum) {
      if (value === 0) {
        setTextValue('0');
      } else {
        setTextValue(value ? value.toLocaleString('en-US') : '');
      }
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    // If completely cleared
    if (!raw.trim()) {
      setTextValue('');
      onChange(0);
      return;
    }

    // Extract digits
    const digits = raw.replace(/\D/g, '');
    if (!digits) {
      setTextValue('');
      onChange(0);
      return;
    }

    const formatted = formatWithCommas(digits);
    setTextValue(formatted);

    const num = parseInt(digits, 10) || 0;
    onChange(num);
  };

  const handleQuickAdd = (addAmount: number) => {
    const currentNum = parseInt(textValue.replace(/\D/g, '') || '0', 10);
    const newNum = currentNum + addAmount;
    setTextValue(newNum.toLocaleString('en-US'));
    onChange(newNum);
  };

  const handleClear = () => {
    setTextValue('0');
    onChange(0);
  };

  const currentNumeric = parseInt(textValue.replace(/\D/g, '') || '0', 10);

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          autoFocus={autoFocus}
          value={textValue}
          onChange={handleChange}
          onFocus={(e) => {
            // If it's just '0', select it so typing replaces it
            if (e.target.value === '0') {
              e.target.select();
            }
          }}
          placeholder={placeholder}
          className={`w-full font-mono text-slate-900 font-bold outline-hidden transition ${className}`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
          VNĐ
        </div>
      </div>

      {/* Quick shortcuts for Tiệm In */}
      <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
        <span className="text-slate-400 font-medium">Nhanh:</span>
        <button
          type="button"
          onClick={() => handleQuickAdd(50000)}
          className="px-1.5 py-0.5 bg-slate-100 hover:bg-amber-100 hover:text-amber-800 text-slate-600 rounded font-mono font-medium cursor-pointer"
        >
          +50k
        </button>
        <button
          type="button"
          onClick={() => handleQuickAdd(100000)}
          className="px-1.5 py-0.5 bg-slate-100 hover:bg-amber-100 hover:text-amber-800 text-slate-600 rounded font-mono font-medium cursor-pointer"
        >
          +100k
        </button>
        <button
          type="button"
          onClick={() => handleQuickAdd(500000)}
          className="px-1.5 py-0.5 bg-slate-100 hover:bg-amber-100 hover:text-amber-800 text-slate-600 rounded font-mono font-medium cursor-pointer"
        >
          +500k
        </button>
        <button
          type="button"
          onClick={() => handleQuickAdd(1000000)}
          className="px-1.5 py-0.5 bg-slate-100 hover:bg-amber-100 hover:text-amber-800 text-slate-600 rounded font-mono font-medium cursor-pointer"
        >
          +1Tr
        </button>
        {currentNumeric > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="px-1.5 py-0.5 bg-red-50 hover:bg-red-100 text-red-600 rounded font-medium cursor-pointer ml-auto"
          >
            Về 0
          </button>
        )}
      </div>

      {/* Words helper */}
      {showWords && currentNumeric > 0 && (
        <div className="p-1.5 px-2 bg-amber-50/80 border border-amber-200/80 rounded-lg text-[11px] text-amber-900 font-medium flex items-center gap-1.5">
          <span className="font-bold text-amber-700 shrink-0">Bằng chữ:</span>
          <span className="italic truncate">{numberToVietnameseWords(currentNumeric)}</span>
        </div>
      )}
    </div>
  );
};
