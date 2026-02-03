import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { Task, SortOption, Priority } from "../types";

/**
 * 優先度の重み付け（ソート用）
 */
const PRIORITY_WEIGHT: Record<Priority, number> = {
  高: 3,
  中: 2,
  低: 1,
};

/**
 * タスクをソートする
 */
function sortTasks(tasks: Task[], sortOption: SortOption): Task[] {
  const sorted = [...tasks];

  sorted.sort((a, b) => {
    switch (sortOption) {
      case "created-desc":
        return b.created.localeCompare(a.created);
      case "created-asc":
        return a.created.localeCompare(b.created);
      case "updated-desc":
        return b.updated.localeCompare(a.updated);
      case "updated-asc":
        return a.updated.localeCompare(b.updated);
      case "due-asc":
        if (a.due === "-") return 1;
        if (b.due === "-") return -1;
        return a.due.localeCompare(b.due);
      case "due-desc":
        if (a.due === "-") return 1;
        if (b.due === "-") return -1;
        return b.due.localeCompare(a.due);
      case "priority-desc":
        return (
          PRIORITY_WEIGHT[b.priority as Priority] -
          PRIORITY_WEIGHT[a.priority as Priority]
        );
      case "priority-asc":
        return (
          PRIORITY_WEIGHT[a.priority as Priority] -
          PRIORITY_WEIGHT[b.priority as Priority]
        );
      default:
        return 0;
    }
  });

  return sorted;
}

/**
 * タスク管理用カスタムフック
 */
export function useTasks(folderPath: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>("created-desc");

  /**
   * タスクを読み込む
   */
  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loadedTasks = await invoke<Task[]>("get_tasks", {
        folderPath,
      });
      setTasks(sortTasks(loadedTasks, sortOption));
    } catch (e) {
      setError(e as string);
    } finally {
      setLoading(false);
    }
  }, [folderPath, sortOption]);

  /**
   * タスクを保存する
   */
  const saveTask = useCallback(
    async (task: Task) => {
      try {
        // 更新日時を現在時刻に更新
        const now = new Date();
        const updated = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        const updatedTask = { ...task, updated };

        // 先にローカル状態を更新（即座に反映）
        setTasks((prev) =>
          sortTasks(
            prev.map((t) => (t.filePath === updatedTask.filePath ? updatedTask : t)),
            sortOption
          )
        );

        // バックグラウンドで保存
        await invoke("save_task", { task: updatedTask });
      } catch (e) {
        setError(e as string);
        // エラー時は再読み込み
        await loadTasks();
      }
    },
    [loadTasks, sortOption]
  );

  /**
   * 新規タスクを作成する
   */
  const createTask = useCallback(
    async (taskData: Omit<Task, "filePath">) => {
      try {
        await invoke<Task>("create_task", {
          folderPath,
          title: taskData.title,
          status: taskData.status,
          priority: taskData.priority,
          due: taskData.due,
          assignee: taskData.assignee,
          subTasks: taskData.subTasks,
          memo: taskData.memo,
        });

        await loadTasks();
      } catch (e) {
        setError(e as string);
      }
    },
    [folderPath, loadTasks]
  );

  /**
   * タスクを削除する
   */
  const deleteTask = useCallback(
    async (filePath: string) => {
      try {
        await invoke("delete_task", { filePath });
        await loadTasks();
      } catch (e) {
        setError(e as string);
      }
    },
    [loadTasks]
  );

  /**
   * ソートオプションを変更
   */
  const changeSortOption = useCallback(
    (option: SortOption) => {
      setSortOption(option);
      setTasks((prev) => sortTasks(prev, option));
    },
    []
  );

  return {
    tasks,
    loading,
    error,
    sortOption,
    loadTasks,
    saveTask,
    createTask,
    deleteTask,
    changeSortOption,
  };
}
