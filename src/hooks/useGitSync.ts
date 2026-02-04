import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { SyncResult } from "../types";

/**
 * Git同期機能を提供するカスタムフック
 */
export function useGitSync(folderPath: string) {
  const [isGitRepo, setIsGitRepo] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);
  const [currentBranch, setCurrentBranch] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  /**
   * Gitリポジトリかどうかをチェック
   */
  const checkGitRepo = useCallback(async () => {
    try {
      const result = await invoke<boolean>("check_git_repo", {
        folderPath,
      });
      setIsGitRepo(result);
      return result;
    } catch (error) {
      console.error("check_git_repo エラー:", error);
      setIsGitRepo(false);
      return false;
    }
  }, [folderPath]);

  /**
   * ブランチ一覧を取得
   */
  const fetchBranches = useCallback(async () => {
    try {
      const result = await invoke<string[]>("get_git_branches", {
        folderPath,
      });
      setBranches(result);
      return result;
    } catch (error) {
      console.error("get_git_branches エラー:", error);
      setBranches([]);
      return [];
    }
  }, [folderPath]);

  /**
   * 現在のブランチを取得
   */
  const fetchCurrentBranch = useCallback(async () => {
    try {
      const result = await invoke<string>("get_current_branch", {
        folderPath,
      });
      setCurrentBranch(result);
      return result;
    } catch (error) {
      console.error("get_current_branch エラー:", error);
      setCurrentBranch("");
      return "";
    }
  }, [folderPath]);

  /**
   * Git同期を実行
   */
  const sync = useCallback(
    async (branch: string): Promise<SyncResult> => {
      setIsSyncing(true);
      setLastSyncResult(null);

      try {
        const result = await invoke<SyncResult>("git_sync", {
          folderPath,
          branch,
        });
        setLastSyncResult(result);
        return result;
      } catch (error) {
        const errorResult: SyncResult = {
          pulled: false,
          pushed: false,
          conflicts: false,
          message: `同期エラー: ${error}`,
        };
        setLastSyncResult(errorResult);
        return errorResult;
      } finally {
        setIsSyncing(false);
      }
    },
    [folderPath]
  );

  /**
   * 初期化時にGit状態をチェック
   */
  useEffect(() => {
    const init = async () => {
      setIsChecking(true);
      const isRepo = await checkGitRepo();
      if (isRepo) {
        await Promise.all([fetchBranches(), fetchCurrentBranch()]);
      }
      setIsChecking(false);
    };
    init();
  }, [checkGitRepo, fetchBranches, fetchCurrentBranch]);

  return {
    isGitRepo,
    branches,
    currentBranch,
    isSyncing,
    lastSyncResult,
    isChecking,
    checkGitRepo,
    fetchBranches,
    fetchCurrentBranch,
    sync,
  };
}
