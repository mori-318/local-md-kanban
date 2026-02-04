/**
 * タスクのステータス
 */
export type Status = "未着手" | "着手中" | "完了";

/**
 * タスクの優先度
 */
export type Priority = "低" | "中" | "高";

/**
 * サブタスク
 */
export interface SubTask {
  text: string;
  completed: boolean;
}

/**
 * タスクデータ
 */
export interface Task {
  /** ファイルパス（一意識別子として使用） */
  filePath: string;
  /** タスク名（ファイルの見出し） */
  title: string;
  /** 作成日時 */
  created: string;
  /** 更新日時 */
  updated: string;
  /** ステータス */
  status: Status;
  /** 優先度 */
  priority: Priority;
  /** 期限 */
  due: string;
  /** 担当者 */
  assignee: string;
  /** サブタスク */
  subTasks: SubTask[];
  /** メモ */
  memo: string;
}

/**
 * ソートオプション
 */
export type SortOption =
  | "created-desc"
  | "created-asc"
  | "updated-desc"
  | "updated-asc"
  | "due-asc"
  | "due-desc"
  | "priority-desc"
  | "priority-asc";

/**
 * ソート設定の表示名
 */
export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "created-desc", label: "作成日時（新しい順）" },
  { value: "created-asc", label: "作成日時（古い順）" },
  { value: "updated-desc", label: "更新日時（新しい順）" },
  { value: "updated-asc", label: "更新日時（古い順）" },
  { value: "due-asc", label: "期限（近い順）" },
  { value: "due-desc", label: "期限（遠い順）" },
  { value: "priority-desc", label: "優先度（高い順）" },
  { value: "priority-asc", label: "優先度（低い順）" },
];

/**
 * ステータスごとの色設定
 */
export const STATUS_COLORS: Record<Status, string> = {
  未着手: "#ef4444",
  着手中: "#eab308",
  完了: "#22c55e",
};

/**
 * Git同期結果
 */
export interface SyncResult {
  pulled: boolean;
  pushed: boolean;
  conflicts: boolean;
  message: string;
}

/**
 * Git設定
 */
export interface GitSettings {
  syncBranch: string;
}
