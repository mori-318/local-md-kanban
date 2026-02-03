import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Task, Status, STATUS_COLORS } from "../types";
import TaskCard from "./TaskCard";

interface KanbanColumnProps {
  status: Status;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

/**
 * ステータスごとのパステルカラー背景
 */
const STATUS_BG_COLORS: Record<Status, string> = {
  未着手: "bg-red-50",
  着手中: "bg-yellow-50",
  完了: "bg-green-50",
};

/**
 * カンバンカラムコンポーネント
 * ステータスごとのタスク一覧を表示
 */
function KanbanColumn({ status, tasks, onTaskClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <div
      className={`flex-1 min-w-[280px] max-w-[350px] rounded-lg p-3 transition-all duration-200 ${STATUS_BG_COLORS[status]} ${
        isOver ? "ring-2 ring-blue-400 scale-[1.02]" : ""
      }`}
    >
      {/* カラムヘッダー */}
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: STATUS_COLORS[status] }}
        />
        <h2 className="font-semibold text-gray-700">{status}</h2>
        <span className="text-sm text-gray-400 ml-auto">{tasks.length}</span>
      </div>

      {/* タスク一覧 */}
      <div
        ref={setNodeRef}
        className="space-y-2 min-h-[100px] overflow-y-auto max-h-[calc(100vh-220px)]"
      >
        <SortableContext
          items={tasks.map((t) => t.filePath)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.filePath}
              task={task}
              onClick={() => onTaskClick(task)}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

export default KanbanColumn;
