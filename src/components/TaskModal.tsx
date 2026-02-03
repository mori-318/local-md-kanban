import { useState, useEffect } from "react";
import { Task, Status, Priority, SubTask } from "../types";
import PrioritySelect from "./PrioritySelect";
import DatePicker from "./DatePicker";

interface TaskModalProps {
  task: Task | null;
  isNew?: boolean;
  onSave: (task: Task) => void;
  onDelete?: (filePath: string) => void;
  onClose: () => void;
}

const STATUSES: Status[] = ["未着手", "着手中", "完了"];

/**
 * タスク編集モーダルコンポーネント
 */
function TaskModal({ task, isNew, onSave, onDelete, onClose }: TaskModalProps) {
  const [editedTask, setEditedTask] = useState<Task | null>(null);
  const [newSubTask, setNewSubTask] = useState("");

  useEffect(() => {
    setEditedTask(task);
  }, [task]);

  /**
   * 保存
   */
  const handleSave = () => {
    if (editedTask) {
      onSave(editedTask);
    }
  };

  /**
   * Cmd+S で保存&クローズ
   */
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.metaKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [editedTask, onSave]);

  if (!editedTask) return null;

  /**
   * フィールド更新
   */
  const updateField = <K extends keyof Task>(field: K, value: Task[K]) => {
    setEditedTask((prev) => (prev ? { ...prev, [field]: value } : null));
  };

  /**
   * サブタスク追加
   */
  const addSubTask = () => {
    if (!newSubTask.trim()) return;
    const newSt: SubTask = { text: newSubTask.trim(), completed: false };
    updateField("subTasks", [...editedTask.subTasks, newSt]);
    setNewSubTask("");
  };

  /**
   * サブタスク削除
   */
  const removeSubTask = (index: number) => {
    updateField(
      "subTasks",
      editedTask.subTasks.filter((_, i) => i !== index)
    );
  };

  /**
   * サブタスクの完了状態切替
   */
  const toggleSubTask = (index: number) => {
    const updated = editedTask.subTasks.map((st, i) =>
      i === index ? { ...st, completed: !st.completed } : st
    );
    updateField("subTasks", updated);
  };

  /**
   * 削除
   */
  const handleDelete = () => {
    if (onDelete && editedTask && window.confirm("このタスクを削除しますか？")) {
      onDelete(editedTask.filePath);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* ヘッダー */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">
            {isNew ? "新規タスク" : "タスク編集"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
          >
            ×
          </button>
        </div>

        {/* フォーム */}
        <div className="p-6 space-y-4">
          {/* タイトル */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              タイトル
            </label>
            <input
              type="text"
              value={editedTask.title}
              onChange={(e) => updateField("title", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="タスク名を入力"
            />
          </div>

          {/* ステータスと優先度 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ステータス
              </label>
              <select
                value={editedTask.status}
                onChange={(e) => updateField("status", e.target.value as Status)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                優先度
              </label>
              <PrioritySelect
                value={editedTask.priority as Priority}
                onChange={(v) => updateField("priority", v)}
              />
            </div>
          </div>

          {/* 期限と担当者 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                期限
              </label>
              <DatePicker
                value={editedTask.due}
                onChange={(v) => updateField("due", v)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                担当者
              </label>
              <input
                type="text"
                value={editedTask.assignee}
                onChange={(e) => updateField("assignee", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="担当者名"
              />
            </div>
          </div>

          {/* サブタスク */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              サブタスク
            </label>
            <div className="space-y-2 mb-2">
              {editedTask.subTasks.map((st, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={st.completed}
                    onChange={() => toggleSubTask(index)}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span
                    className={`flex-1 text-sm ${st.completed ? "line-through text-gray-400" : "text-gray-700"}`}
                  >
                    {st.text}
                  </span>
                  <button
                    onClick={() => removeSubTask(index)}
                    className="text-gray-400 hover:text-red-500 text-sm"
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newSubTask}
                onChange={(e) => setNewSubTask(e.target.value)}
                onKeyDown={(e) => {
                  // IME変換中はkeyCode=229、またはisComposing=true
                  // 両方チェックして確実にIME入力を無視する
                  if (
                    e.key === "Enter" &&
                    !e.nativeEvent.isComposing &&
                    (e as React.KeyboardEvent & { keyCode?: number }).keyCode !== 229
                  ) {
                    e.preventDefault();
                    addSubTask();
                  }
                }}
                className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="サブタスクを追加"
              />
              <button
                onClick={addSubTask}
                className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                追加
              </button>
            </div>
          </div>

          {/* メモ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              メモ
            </label>
            <textarea
              value={editedTask.memo}
              onChange={(e) => updateField("memo", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={4}
              placeholder="自由にメモを記述"
            />
          </div>
        </div>

        {/* フッター */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex justify-between">
          {!isNew && onDelete && (
            <button
              onClick={handleDelete}
              className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
            >
              削除
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TaskModal;
