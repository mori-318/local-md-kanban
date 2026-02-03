import { useState } from "react";
import { open } from "@tauri-apps/api/dialog";
import { invoke } from "@tauri-apps/api/tauri";

interface HomeProps {
  onFolderSelect: (folderPath: string) => void;
}

/**
 * ホーム画面コンポーネント
 * フォルダ選択・新規作成機能を提供
 */
function Home({ onFolderSelect }: HomeProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [parentPath, setParentPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  /**
   * フォルダ選択ダイアログを開く
   */
  const handleSelectFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "タスクフォルダを選択",
    });

    if (selected && typeof selected === "string") {
      onFolderSelect(selected);
    }
  };

  /**
   * 親フォルダ選択ダイアログを開く
   */
  const handleSelectParentFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "新規フォルダの作成場所を選択",
    });

    if (selected && typeof selected === "string") {
      setParentPath(selected);
    }
  };

  /**
   * 新規フォルダ作成
   */
  const handleCreateFolder = async () => {
    if (!parentPath || !folderName.trim()) {
      setError("作成場所とフォルダ名を入力してください");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const newFolderPath = await invoke<string>("create_task_folder", {
        parentPath,
        folderName: folderName.trim(),
      });
      setShowCreateModal(false);
      setFolderName("");
      setParentPath("");
      onFolderSelect(newFolderPath);
    } catch (e) {
      setError(e as string);
    } finally {
      setIsCreating(false);
    }
  };

  /**
   * モーダルを閉じる
   */
  const handleCloseModal = () => {
    setShowCreateModal(false);
    setFolderName("");
    setParentPath("");
    setError(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          ローカルMDカンバン
        </h1>
        <p className="text-gray-500 mb-8">
          マークダウンファイルでタスクを管理
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={handleSelectFolder}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors shadow-sm"
          >
            既存フォルダを開く
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors shadow-sm"
          >
            新規フォルダを作成
          </button>
        </div>
      </div>

      {/* 新規フォルダ作成モーダル */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">
                新規タスクフォルダを作成
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* 作成場所 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  作成場所
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={parentPath}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 text-sm"
                    placeholder="フォルダを選択..."
                  />
                  <button
                    onClick={handleSelectParentFolder}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                  >
                    選択
                  </button>
                </div>
              </div>

              {/* フォルダ名 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  フォルダ名
                </label>
                <input
                  type="text"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="例: プロジェクトA"
                />
              </div>

              {/* エラー表示 */}
              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                キャンセル
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={isCreating}
                className="px-4 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
              >
                {isCreating ? "作成中..." : "作成"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
