import { useEffect, useState, useCallback, useRef } from "react";
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
import { Task, Status, GitSettings } from "../types";
import { useTasks } from "../hooks/useTasks";
import { useGitSync } from "../hooks/useGitSync";
import KanbanColumn from "./KanbanColumn";
import TaskCard from "./TaskCard";
import TaskModal from "./TaskModal";
import SortSelector from "./SortSelector";

const GIT_SETTINGS_KEY = "local-md-kanban-git-settings";
const DEFAULT_GIT_SETTINGS: GitSettings = { syncBranch: "main" };

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

  const {
    isGitRepo,
    branches,
    currentBranch,
    isSyncing,
    lastSyncResult,
    isChecking,
    sync,
  } = useGitSync(folderPath);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isNewTask, setIsNewTask] = useState(false);
  const [localTasks, setLocalTasks] = useState<Task[]>([]);
  const [draggingTask, setDraggingTask] = useState<Task | null>(null);
  const [originalStatus, setOriginalStatus] = useState<Status | null>(null);
  const [gitSettings, setGitSettings] = useState<GitSettings>(DEFAULT_GIT_SETTINGS);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const initialSyncDone = useRef(false);

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

  // Git設定の読み込み
  useEffect(() => {
    const saved = localStorage.getItem(GIT_SETTINGS_KEY);
    if (saved) {
      try {
        setGitSettings(JSON.parse(saved));
      } catch {
        setGitSettings(DEFAULT_GIT_SETTINGS);
      }
    }
  }, []);

  /**
   * 同期先ブランチを変更
   */
  const handleBranchChange = (branch: string) => {
    const newSettings = { ...gitSettings, syncBranch: branch };
    setGitSettings(newSettings);
    localStorage.setItem(GIT_SETTINGS_KEY, JSON.stringify(newSettings));
    setShowBranchDropdown(false);
  };

  /**
   * Git同期を実行
   */
  const handleSync = useCallback(async () => {
    if (!isGitRepo || isSyncing) return;

    setSyncMessage(null);
    const result = await sync(gitSettings.syncBranch);
    setSyncMessage(result.message);

    // 同期後にタスクを再読み込み
    if (result.pulled) {
      await loadTasks();
    }

    // メッセージを3秒後に消す
    setTimeout(() => setSyncMessage(null), 3000);
  }, [isGitRepo, isSyncing, sync, gitSettings.syncBranch, loadTasks]);

  // フォルダ選択時の自動同期
  useEffect(() => {
    if (!isChecking && isGitRepo && !initialSyncDone.current) {
      initialSyncDone.current = true;
      handleSync();
    }
  }, [isChecking, isGitRepo, handleSync]);

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showBranchDropdown) {
        const target = event.target as HTMLElement;
        if (!target.closest('[data-branch-dropdown]')) {
          setShowBranchDropdown(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showBranchDropdown]);

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

    const newTask: Task = {
      filePath: "",
      title: "",
      created: datetime,
      updated: datetime,
      status: "未着手",
      priority: "低",
      due: "-",
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
            className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 active:bg-gray-300 transition-colors"
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
              className="text-gray-500 hover:text-gray-700 active:text-gray-900 transition-colors"
            >
              ← 戻る
            </button>
            <h1 className="text-lg font-semibold text-gray-800">
              {folderPath.split("/").pop()}
            </h1>
            {/* 同期状態表示 */}
            {(isChecking || isSyncing) && (
              <span className="text-sm text-blue-600 flex items-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
                {isChecking ? "Git確認中..." : "同期中..."}
              </span>
            )}
            {/* 同期メッセージ */}
            {syncMessage && !isSyncing && (
              <span className={`text-sm ${lastSyncResult?.conflicts ? 'text-red-500' : 'text-green-600'}`}>
                {syncMessage}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Git同期ボタン（Git管理されている場合のみ表示） */}
            {isGitRepo && (
              <>
                <button
                  onClick={handleSync}
                  disabled={isSyncing || isChecking}
                  className={`px-3 py-2 text-sm rounded-lg flex items-center gap-2 transition-colors ${
                    isSyncing || isChecking
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300"
                  }`}
                  title="Git同期"
                >
                  {isSyncing ? "同期中..." : "↻ 同期"}
                </button>
                {/* ブランチ選択 */}
                <div className="relative" data-branch-dropdown>
                  <button
                    onClick={() => setShowBranchDropdown(!showBranchDropdown)}
                    className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 active:bg-gray-300 transition-colors flex items-center gap-1"
                  >
                    <span className="max-w-[100px] truncate">{gitSettings.syncBranch}</span>
                    <span className="text-xs">▼</span>
                  </button>
                  {showBranchDropdown && (
                    <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                      {branches.map((branch) => (
                        <button
                          key={branch}
                          onClick={() => handleBranchChange(branch)}
                          className={`w-full px-4 py-2 text-left text-sm transition-colors hover:bg-gray-100 active:bg-gray-200 ${
                            branch === gitSettings.syncBranch ? "bg-blue-50 text-blue-600 hover:bg-blue-100 active:bg-blue-200" : ""
                          }`}
                        >
                          {branch}
                          {branch === currentBranch && (
                            <span className="ml-2 text-xs text-gray-400">(現在)</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
            <SortSelector value={sortOption} onChange={changeSortOption} />
            <button
              onClick={handleCreateTask}
              className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 active:bg-blue-700 transition-colors"
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
