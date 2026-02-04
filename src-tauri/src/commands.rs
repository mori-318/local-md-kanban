//! Tauriコマンド定義モジュール

use crate::parser::{parse_markdown, task_to_markdown, SubTask, Task};
use chrono::Local;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::process::Command;
use tauri::AppHandle;

/// Git同期結果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResult {
    pub pulled: bool,
    pub pushed: bool,
    pub conflicts: bool,
    pub message: String,
}

/// 指定フォルダ内のすべてのマークダウンファイルを読み込みタスクリストを返す
#[tauri::command]
pub fn get_tasks(folder_path: String) -> Result<Vec<Task>, String> {
    let path = Path::new(&folder_path);
    if !path.exists() || !path.is_dir() {
        return Err("指定されたフォルダが存在しません".to_string());
    }

    let mut tasks = Vec::new();

    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_path = entry.path();

        // .mdファイルのみ処理（template.mdとtask-naming.mdは除外）
        if file_path.extension().map_or(false, |ext| ext == "md") {
            let file_name = file_path.file_name().unwrap_or_default().to_string_lossy();
            if file_name == "template.md" || file_name == "task-naming.md" {
                continue;
            }

            let content = fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
            match parse_markdown(&content, file_path.to_string_lossy().as_ref()) {
                Ok(task) => tasks.push(task),
                Err(e) => eprintln!("Failed to parse {}: {}", file_path.display(), e),
            }
        }
    }

    Ok(tasks)
}

/// タスクを保存（既存ファイルを上書き）
#[tauri::command]
pub fn save_task(task: Task) -> Result<(), String> {
    let markdown = task_to_markdown(&task);
    fs::write(&task.file_path, markdown).map_err(|e| e.to_string())?;
    Ok(())
}

/// 新規タスクを作成
/// フロントから渡された値で初期状態を反映し、1回の書き込みで保存する
#[tauri::command]
pub fn create_task(
    folder_path: String,
    title: String,
    status: Option<String>,
    priority: Option<String>,
    due: Option<String>,
    assignee: Option<String>,
    sub_tasks: Option<Vec<SubTask>>,
    memo: Option<String>,
) -> Result<Task, String> {
    let now = Local::now();
    let datetime_str = now.format("%Y-%m-%d-%H:%M").to_string();
    let date_str = now.format("%Y-%m-%d").to_string();

    // ファイル名を生成（タイトルをサニタイズ）
    let safe_title: String = title
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' {
                c
            } else if c == ' ' {
                '_'
            } else {
                '_'
            }
        })
        .collect();
    let timestamp = now.format("%Y%m%d%H%M%S").to_string();
    let file_name = format!("{}_{}.md", safe_title, timestamp);
    let file_path = Path::new(&folder_path).join(&file_name);

    let task = Task {
        file_path: file_path.to_string_lossy().to_string(),
        title: if title.is_empty() {
            "-".to_string()
        } else {
            title
        },
        created: datetime_str.clone(),
        updated: datetime_str,
        status: status.unwrap_or_else(|| "未着手".to_string()),
        priority: priority.unwrap_or_else(|| "低".to_string()),
        due: due.unwrap_or_else(|| date_str.clone()),
        assignee: assignee.unwrap_or_else(|| "-".to_string()),
        sub_tasks: sub_tasks.unwrap_or_default(),
        memo: memo.unwrap_or_default(),
    };

    let markdown = task_to_markdown(&task);
    fs::write(&file_path, markdown).map_err(|e| e.to_string())?;

    Ok(task)
}

/// タスクを削除
#[tauri::command]
pub fn delete_task(file_path: String) -> Result<(), String> {
    fs::remove_file(&file_path).map_err(|e| e.to_string())?;
    Ok(())
}

/// 新規タスクフォルダを作成し、template.mdを配置
#[tauri::command]
pub fn create_task_folder(
    app_handle: AppHandle,
    parent_path: String,
    folder_name: String,
) -> Result<String, String> {
    let new_folder_path = Path::new(&parent_path).join(&folder_name);

    // フォルダが既に存在する場合はエラー
    if new_folder_path.exists() {
        return Err("同名のフォルダが既に存在します".to_string());
    }

    // フォルダを作成
    fs::create_dir(&new_folder_path).map_err(|e| e.to_string())?;

    // リソースからtemplate.mdを読み込む
    let template_path = app_handle
        .path_resolver()
        .resolve_resource("resources/template.md")
        .ok_or("テンプレートファイルが見つかりません")?;

    let template_content = fs::read_to_string(&template_path)
        .map_err(|e| format!("テンプレートの読み込みに失敗: {}", e))?;

    // 新しいフォルダにtemplate.mdをコピー
    let template_dest = new_folder_path.join("template.md");
    fs::write(&template_dest, template_content).map_err(|e| e.to_string())?;

    // タスク命名ガイドをコピー
    let naming_path = app_handle
        .path_resolver()
        .resolve_resource("resources/task-naming.md")
        .ok_or("タスク命名ガイドが見つかりません")?;

    let naming_content = fs::read_to_string(&naming_path)
        .map_err(|e| format!("命名ガイドの読み込みに失敗: {}", e))?;

    let naming_dest = new_folder_path.join("task-naming.md");
    fs::write(&naming_dest, naming_content).map_err(|e| e.to_string())?;

    Ok(new_folder_path.to_string_lossy().to_string())
}

/// フォルダがGitリポジトリかどうかをチェック
#[tauri::command]
pub fn check_git_repo(folder_path: String) -> bool {
    let path = Path::new(&folder_path);

    // フォルダ自体に.gitがあるか、親ディレクトリを辿って.gitを探す
    let mut current = path;
    loop {
        if current.join(".git").exists() {
            return true;
        }
        match current.parent() {
            Some(parent) => current = parent,
            None => break,
        }
    }
    false
}

/// Gitブランチ一覧を取得
#[tauri::command]
pub fn get_git_branches(folder_path: String) -> Result<Vec<String>, String> {
    let output = Command::new("git")
        .args(["branch", "-a"])
        .current_dir(&folder_path)
        .output()
        .map_err(|e| format!("git branch 実行エラー: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git branch 失敗: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let branches: Vec<String> = stdout
        .lines()
        .map(|line| {
            line.trim()
                .trim_start_matches("* ")
                .trim_start_matches("remotes/origin/")
                .to_string()
        })
        .filter(|b| !b.is_empty() && !b.contains("HEAD"))
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();

    Ok(branches)
}

/// 現在のGitブランチを取得
#[tauri::command]
pub fn get_current_branch(folder_path: String) -> Result<String, String> {
    let output = Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(&folder_path)
        .output()
        .map_err(|e| format!("git rev-parse 実行エラー: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git rev-parse 失敗: {}", stderr));
    }

    let branch = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(branch)
}

/// Git同期を実行（pull → add → commit → push）
#[tauri::command]
pub fn git_sync(folder_path: String, branch: String) -> Result<SyncResult, String> {
    let now = Local::now();
    let commit_message = format!("タスク同期: {}", now.format("%Y-%m-%d %H:%M"));

    // 1. 現在のブランチを確認（インライン実行で高速化）
    let branch_output = Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(&folder_path)
        .output()
        .map_err(|e| format!("git rev-parse 実行エラー: {}", e))?;

    let current_branch = if branch_output.status.success() {
        String::from_utf8_lossy(&branch_output.stdout).trim().to_string()
    } else {
        String::new()
    };

    // 2. 必要に応じてブランチを切り替え
    if !current_branch.is_empty() && current_branch != branch {
        let checkout_output = Command::new("git")
            .args(["checkout", &branch])
            .current_dir(&folder_path)
            .output()
            .map_err(|e| format!("git checkout 実行エラー: {}", e))?;

        if !checkout_output.status.success() {
            let stderr = String::from_utf8_lossy(&checkout_output.stderr);
            return Err(format!("git checkout 失敗: {}", stderr));
        }
    }

    // 3. git fetch origin（バックグラウンドでなく必要な分だけ取得）
    let _ = Command::new("git")
        .args(["fetch", "origin", &branch])
        .current_dir(&folder_path)
        .output();

    // 4. git pull origin <branch>
    let mut pulled = false;
    let pull_output = Command::new("git")
        .args(["pull", "origin", &branch])
        .current_dir(&folder_path)
        .output()
        .map_err(|e| format!("git pull 実行エラー: {}", e))?;

    if !pull_output.status.success() {
        let stderr = String::from_utf8_lossy(&pull_output.stderr);
        // コンフリクトの可能性をチェック
        if stderr.contains("CONFLICT") || stderr.contains("conflict") {
            return Ok(SyncResult {
                pulled: false,
                pushed: false,
                conflicts: true,
                message: "コンフリクトが発生しました。手動で解決してください。".to_string(),
            });
        }
        // リモートブランチが存在しない場合は続行
        if !stderr.contains("couldn't find remote ref") {
            return Err(format!("git pull 失敗: {}", stderr));
        }
    } else {
        let stdout = String::from_utf8_lossy(&pull_output.stdout);
        pulled = !stdout.contains("Already up to date");
    }

    // 5. git add .
    let add_output = Command::new("git")
        .args(["add", "."])
        .current_dir(&folder_path)
        .output()
        .map_err(|e| format!("git add 実行エラー: {}", e))?;

    if !add_output.status.success() {
        let stderr = String::from_utf8_lossy(&add_output.stderr);
        return Err(format!("git add 失敗: {}", stderr));
    }

    // 6. 変更があるかチェック
    let status_output = Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(&folder_path)
        .output()
        .map_err(|e| format!("git status 実行エラー: {}", e))?;

    let has_changes = !String::from_utf8_lossy(&status_output.stdout).trim().is_empty();

    let mut pushed = false;
    if has_changes {
        // 7. git commit
        let commit_output = Command::new("git")
            .args(["commit", "-m", &commit_message])
            .current_dir(&folder_path)
            .output()
            .map_err(|e| format!("git commit 実行エラー: {}", e))?;

        if !commit_output.status.success() {
            let stderr = String::from_utf8_lossy(&commit_output.stderr);
            // "nothing to commit" は成功として扱う
            if !stderr.contains("nothing to commit") {
                return Err(format!("git commit 失敗: {}", stderr));
            }
        }

        // 8. git push origin <branch>
        let push_output = Command::new("git")
            .args(["push", "origin", &branch])
            .current_dir(&folder_path)
            .output()
            .map_err(|e| format!("git push 実行エラー: {}", e))?;

        if !push_output.status.success() {
            let stderr = String::from_utf8_lossy(&push_output.stderr);
            return Err(format!("git push 失敗: {}", stderr));
        }
        pushed = true;
    }

    let message = match (pulled, pushed) {
        (true, true) => "変更を取得し、ローカルの変更をプッシュしました。".to_string(),
        (true, false) => "変更を取得しました。".to_string(),
        (false, true) => "ローカルの変更をプッシュしました。".to_string(),
        (false, false) => "変更はありません。".to_string(),
    };

    Ok(SyncResult {
        pulled,
        pushed,
        conflicts: false,
        message,
    })
}
