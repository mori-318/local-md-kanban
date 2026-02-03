import { Priority } from "../types";

interface PrioritySelectProps {
  value: Priority;
  onChange: (value: Priority) => void;
}

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: "低", label: "低", color: "bg-gray-100 text-gray-600" },
  { value: "中", label: "中", color: "bg-yellow-100 text-yellow-700" },
  { value: "高", label: "高", color: "bg-red-100 text-red-700" },
];

/**
 * 優先度選択コンポーネント
 */
function PrioritySelect({ value, onChange }: PrioritySelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Priority)}
      className={`px-3 py-1.5 text-sm border-0 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        PRIORITIES.find((p) => p.value === value)?.color || ""
      }`}
    >
      {PRIORITIES.map((priority) => (
        <option key={priority.value} value={priority.value}>
          {priority.label}
        </option>
      ))}
    </select>
  );
}

export default PrioritySelect;
