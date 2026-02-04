import { useEffect, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  MeasuringStrategy,
} from "@dnd-kit/core";
import { Task, Status } from "../types";
import { useTasks } from "../hooks/useTasks";
import KanbanColumn from "./KanbanColumn";
import TaskCard from "./TaskCard";
import TaskModal from "./TaskModal";
import SortSelector from "./SortSelector";

interface KanbanBoardProps {
  folderPath: string;
  onBackToHome: () => void;
}

const STATUSES: Status[] = ["未着手", "着手中", "完了"];

/**
 * カンバンボードコンポーネント
 * タスクをステータス別に表示し、ドラッグ＆ドロップで移動可能
 */
function KanbanBoard({ folderPath, onBackToHome }: KanbanBoardProps) {
  const {
    tasks,
    loading,
    error,
    sortOption,
    loadTasks,
    saveTask,
    createTask,
    deleteTask,
    changeSortOption,
  } = useTasks(folderPath);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isNewTask, setIsNewTask] = useState(false);
  const [localTasks, setLocalTasks] = useState<Task[]>([]);
  const [draggingTask, setDraggingTask] = useState<Task | null>(null);
  const [originalStatus, setOriginalStatus] = useState<Status | null>(null);

  // ドラッグセンサーの設定
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  // 測定設定（アニメーション最適化）
  const measuring = {
    droppable: {
      strategy: MeasuringStrategy.Always,
    },
  };

  // 初回ロード
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // タスク更新時にローカル状態を同期
  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  /**
   * ステータス別にタスクをフィルタ
   */
  const getTasksByStatus = (status: Status) =>
    localTasks.filter((task) => task.status === status);

  /**
   * ドラッグ開始時のハンドラ
   */
  const handleDragStart = (event: DragStartEvent) => {
    const taskId = event.active.id as string;
    const task = localTasks.find((t) => t.filePath === taskId);
    if (task) {
      setDraggingTask(task);
      setOriginalStatus(task.status);
    }
  };

  /**
   * over.idからステータスを取得する
   * over.idがステータス名の場合はそのまま返し、
   * タスクのfilePathの場合はそのタスクのステータスを返す
   */
  const getStatusFromOverId = useCallback(
    (overId: string): Status | null => {
      if (STATUSES.includes(overId as Status)) {
        return overId as Status;
      }
      // over.idがタスクのfilePathの場合、そのタスクのステータスを取得
      const overTask = localTasks.find((t) => t.filePath === overId);
      return overTask ? overTask.status : null;
    },
    [localTasks]
  );

  /**
   * ドラッグ終了時のハンドラ
   */
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const currentOriginalStatus = originalStatus;

    setDraggingTask(null);
    setOriginalStatus(null);

    if (!over) {
      // ドロップ先がない場合は元に戻す
      if (currentOriginalStatus) {
        setLocalTasks((prev) =>
          prev.map((t) =>
            t.filePath === active.id ? { ...t, status: currentOriginalStatus } : t
          )
        );
      }
      return;
    }

    const taskId = active.id as string;
    const task = localTasks.find((t) => t.filePath === taskId);
    if (!task) return;

    // ドロップ先のステータスを取得（カラムまたはタスクの上）
    const newStatus = getStatusFromOverId(over.id as string);
    if (newStatus && currentOriginalStatus !== newStatus) {
      const updatedTask = { ...task, status: newStatus };
      await saveTask(updatedTask);
    }
  };

  /**
   * ドラッグオーバー時のハンドラ（リアルタイムプレビュー用）
   */
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const newStatus = getStatusFromOverId(over.id as string);

    if (newStatus) {
      setLocalTasks((prev) => {
        const currentTask = prev.find((t) => t.filePath === taskId);
        // 同じステータスなら更新しない
        if (currentTask?.status === newStatus) {
          return prev;
        }
        return prev.map((t) =>
          t.filePath === taskId ? { ...t, status: newStatus } : t
        );
      });
    }
  };

  /**
   * 新規タスク作成
   */
  const handleCreateTask = useCallback(async () => {
    const now = new Date();
    const datetime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const newTask: Task = {
      filePath: "",
      title: "",
      created: datetime,
      updated: datetime,
      status: "未着手",
      priority: "低",
      due: date,
      assignee: "-",
      subTasks: [],
      memo: "",
    };

    setSelectedTask(newTask);
    setIsNewTask(true);
  }, []);

  /**
   * Cmd+N で新規タスクモーダルを開く
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey && (event.key === "n" || event.key === "N")) {
        event.preventDefault();
        event.stopPropagation();
        if (!selectedTask) {
          handleCreateTask();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCreateTask, selectedTask]);

  /**
   * Tauri メニュー経由の新規タスク作成（Cmd+N）
   */
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const setup = async () => {
      unlisten = await listen("menu-new-task", () => {
        if (!selectedTask) {
          handleCreateTask();
        }
      });
    };
    setup();
    return () => {
      if (unlisten) unlisten();
    };
  }, [handleCreateTask, selectedTask]);

  /**
   * タスク保存
   */
  const handleSaveTask = async (task: Task) => {
    if (isNewTask) {
      // 新規作成時はタスク全体を渡す
      const { filePath: _, ...taskData } = task;
      await createTask(taskData);
    } else {
      await saveTask(task);
    }
    setSelectedTask(null);
    setIsNewTask(false);
  };

  /**
   * タスク削除
   */
  const handleDeleteTask = async (filePath: string) => {
    await deleteTask(filePath);
    setSelectedTask(null);
  };

  if (loading && localTasks.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">エラー: {error}</p>
          <button
            onClick={onBackToHome}
            className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBackToHome}
              className="text-gray-500 hover:text-gray-700"
            >
              ← 戻る
            </button>
            <h1 className="text-lg font-semibold text-gray-800">
              {folderPath.split("/").pop()}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <SortSelector value={sortOption} onChange={changeSortOption} />
            <button
              onClick={handleCreateTask}
              className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
            >
              + 新規タスク
            </button>
          </div>
        </div>
      </header>

      {/* カンバンボード */}
      <main className="flex-1 p-6 overflow-x-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          measuring={measuring}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
        >
          <div className="flex gap-4 min-h-full">
            {STATUSES.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                tasks={getTasksByStatus(status)}
                onTaskClick={(task) => {
                  setSelectedTask(task);
                  setIsNewTask(false);
                }}
              />
            ))}
          </div>
          <DragOverlay
            dropAnimation={{
              duration: 250,
              easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
            }}
          >
            {draggingTask && (
              <div className="shadow-xl rotate-2 scale-105 transition-transform">
                <TaskCard task={draggingTask} onClick={() => {}} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </main>

      {/* タスクモーダル */}
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          isNew={isNewTask}
          onSave={handleSaveTask}
          onDelete={!isNewTask ? handleDeleteTask : undefined}
          onClose={() => {
            setSelectedTask(null);
            setIsNewTask(false);
          }}
        />
      )}
    </div>
  );
}

export default KanbanBoard;
