import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Task, STATUS_COLORS, Priority } from "../types";

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

/**
 * 優先度バッジの色
 */
const PRIORITY_BADGE: Record<Priority, string> = {
  低: "bg-gray-100 text-gray-600",
  中: "bg-yellow-100 text-yellow-700",
  高: "bg-red-100 text-red-700",
};

/**
 * タスクカードコンポーネント
 * ドラッグ可能なカード
 */
function TaskCard({ task, onClick }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.filePath });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || "transform 250ms cubic-bezier(0.25, 1, 0.5, 1), opacity 200ms ease",
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  // 完了したサブタスクの数と完了率
  const completedSubTasks = task.subTasks.filter((st) => st.completed).length;
  const totalSubTasks = task.subTasks.length;
  const completionRate = totalSubTasks > 0 ? Math.round((completedSubTasks / totalSubTasks) * 100) : 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 cursor-pointer hover:shadow-md transition-all duration-200"
    >
      {/* ステータスインジケーター */}
      <div
        className="w-full h-1 rounded-full mb-2"
        style={{ backgroundColor: STATUS_COLORS[task.status] }}
      />

      {/* タイトル */}
      <h3 className="font-medium text-gray-800 text-sm mb-2 line-clamp-2">
        {task.title}
      </h3>

      {/* サブタスク進捗バー（サブタスクがある場合は0%でも表示） */}
      {totalSubTasks > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>サブタスク</span>
            <span className={completionRate === 0 ? "text-gray-400" : completionRate === 100 ? "text-green-600 font-medium" : ""}>
              {completedSubTasks}/{totalSubTasks} ({completionRate}%)
            </span>
          </div>
          <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                completionRate === 0 ? "bg-gray-300" : completionRate === 100 ? "bg-green-500" : "bg-blue-500"
              }`}
              style={{ width: completionRate === 0 ? "100%" : `${completionRate}%`, opacity: completionRate === 0 ? 0.3 : 1 }}
            />
          </div>
        </div>
      )}

      {/* メタ情報 */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        {/* 優先度バッジ */}
        <span
          className={`px-2 py-0.5 rounded ${PRIORITY_BADGE[task.priority as Priority]}`}
        >
          {task.priority}
        </span>

        {/* 期限 */}
        {task.due && task.due !== "-" && (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-50 text-gray-600 rounded">
            <span className="text-gray-400">期限</span>
            <span className="font-medium text-gray-700">{task.due}</span>
          </span>
        )}

        {/* 担当者 */}
        {task.assignee && task.assignee !== "-" && (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-50 text-gray-600 rounded">
            <span className="text-gray-400">担当</span>
            <span className="font-medium text-gray-700">{task.assignee}</span>
          </span>
        )}
      </div>
    </div>
  );
}

export default TaskCard;
