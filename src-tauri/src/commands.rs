//! Tauriコマンド定義モジュール

use crate::parser::{parse_markdown, task_to_markdown, SubTask, Task};
use chrono::Local;
use std::fs;
use std::path::Path;
use tauri::AppHandle;

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

        // .mdファイルのみ処理（template.mdは除外）
        if file_path.extension().map_or(false, |ext| ext == "md") {
            let file_name = file_path.file_name().unwrap_or_default().to_string_lossy();
            if file_name == "template.md" {
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
