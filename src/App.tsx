import { useState, useEffect } from "react";
import Home from "./components/Home";
import KanbanBoard from "./components/KanbanBoard";

const STORAGE_KEY = "local-md-kanban-last-folder";

/**
 * アプリケーションのルートコンポーネント
 * フォルダ選択状態に応じてホーム画面またはカンバンボードを表示
 */
function App() {
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  /**
   * 起動時に最後に開いたフォルダを復元
   */
  useEffect(() => {
    const savedFolder = localStorage.getItem(STORAGE_KEY);
    if (savedFolder) {
      setSelectedFolder(savedFolder);
    }
    setIsInitialized(true);
  }, []);

  /**
   * フォルダ選択時のハンドラ
   */
  const handleFolderSelect = (folderPath: string) => {
    setSelectedFolder(folderPath);
    localStorage.setItem(STORAGE_KEY, folderPath);
  };

  /**
   * ホームに戻る
   */
  const handleBackToHome = () => {
    setSelectedFolder(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  // 初期化完了まで何も表示しない（ちらつき防止）
  if (!isInitialized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {selectedFolder ? (
        <KanbanBoard
          folderPath={selectedFolder}
          onBackToHome={handleBackToHome}
        />
      ) : (
        <Home onFolderSelect={handleFolderSelect} />
      )}
    </div>
  );
}

export default App;
