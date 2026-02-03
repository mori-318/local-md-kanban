import { useState, useRef, useEffect } from "react";
import { DayPicker } from "react-day-picker";
import { format, parse, isValid } from "date-fns";
import { ja } from "date-fns/locale";
import "react-day-picker/dist/style.css";

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/**
 * 日付選択コンポーネント
 * カレンダーUIで日付を選択可能
 */
function DatePicker({
  value,
  onChange,
  placeholder = "日付を選択",
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // valueをDateオブジェクトに変換
  const selectedDate =
    value && value !== "-"
      ? parse(value, "yyyy-MM-dd", new Date())
      : undefined;

  /**
   * 日付選択時のハンドラ
   */
  const handleSelect = (date: Date | undefined) => {
    if (date && isValid(date)) {
      onChange(format(date, "yyyy-MM-dd"));
    } else {
      onChange("-");
    }
    setIsOpen(false);
  };

  /**
   * 外部クリックでカレンダーを閉じる
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-1.5 text-sm text-left border border-gray-200 rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {value && value !== "-" ? value : placeholder}
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            locale={ja}
            showOutsideDays
            className="p-2"
          />
          <div className="px-3 pb-2">
            <button
              type="button"
              onClick={() => {
                onChange("-");
                setIsOpen(false);
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              クリア
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DatePicker;
