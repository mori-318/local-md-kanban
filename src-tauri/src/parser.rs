//! マークダウンファイルのパースと生成を行うモジュール

use regex::Regex;
use serde::{Deserialize, Serialize};

/// サブタスクの構造体
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubTask {
    pub text: String,
    pub completed: bool,
}

/// タスクのデータ構造
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub file_path: String,
    pub title: String,
    pub created: String,
    pub updated: String,
    pub status: String,
    pub priority: String,
    pub due: String,
    pub assignee: String,
    pub sub_tasks: Vec<SubTask>,
    pub memo: String,
}

/// マークダウンファイルをパースしてTaskに変換
pub fn parse_markdown(content: &str, file_path: &str) -> Result<Task, String> {
    let lines: Vec<&str> = content.lines().collect();

    // タイトルを取得（最初の # で始まる行）
    let title = lines
        .iter()
        .find(|line| line.starts_with("# "))
        .map(|line| line.trim_start_matches("# ").to_string())
        .unwrap_or_else(|| "-".to_string());

    // メタデータをパース
    let created = extract_metadata(&lines, "created").unwrap_or_else(|| "-".to_string());
    let updated = extract_metadata(&lines, "updated").unwrap_or_else(|| "-".to_string());
    let status = extract_metadata(&lines, "status").unwrap_or_else(|| "未着手".to_string());
    let priority = extract_metadata(&lines, "priority").unwrap_or_else(|| "低".to_string());
    let due = extract_metadata(&lines, "due").unwrap_or_else(|| "-".to_string());
    let assignee = extract_metadata(&lines, "assignee").unwrap_or_else(|| "-".to_string());

    // サブタスクをパース
    let sub_tasks = parse_subtasks(&lines);

    // メモをパース
    let memo = parse_memo(&lines);

    Ok(Task {
        file_path: file_path.to_string(),
        title,
        created,
        updated,
        status,
        priority,
        due,
        assignee,
        sub_tasks,
        memo,
    })
}

/// メタデータを抽出
fn extract_metadata(lines: &[&str], key: &str) -> Option<String> {
    let pattern = format!(r"^-\s*{}:\s*(.+)$", key);
    let re = Regex::new(&pattern).ok()?;

    for line in lines {
        if let Some(caps) = re.captures(line) {
            let value = caps.get(1)?.as_str().trim();
            // 括弧内の説明を除去
            let value = value.split('（').next().unwrap_or(value).trim();
            return Some(value.to_string());
        }
    }
    None
}

/// サブタスクをパース
fn parse_subtasks(lines: &[&str]) -> Vec<SubTask> {
    let mut sub_tasks = Vec::new();
    let mut in_subtasks = false;
    let checkbox_re = Regex::new(r"^-\s*\[([ xX])\]\s*(.+)$").unwrap();

    for line in lines {
        if line.contains("## サブタスク") {
            in_subtasks = true;
            continue;
        }
        if line.starts_with("## ") && in_subtasks {
            break;
        }
        if in_subtasks {
            if let Some(caps) = checkbox_re.captures(line) {
                let completed = caps.get(1).map(|m| m.as_str() != " ").unwrap_or(false);
                let text = caps
                    .get(2)
                    .map(|m| m.as_str().trim().to_string())
                    .unwrap_or_default();
                if text != "-" && !text.is_empty() {
                    sub_tasks.push(SubTask { text, completed });
                }
            }
        }
    }
    sub_tasks
}

/// メモをパース
fn parse_memo(lines: &[&str]) -> String {
    let mut memo_lines = Vec::new();
    let mut in_memo = false;

    for line in lines {
        if line.contains("## メモ") {
            in_memo = true;
            continue;
        }
        if line.starts_with("## ") && in_memo {
            break;
        }
        if in_memo && !line.trim().is_empty() {
            memo_lines.push(line.to_string());
        }
    }
    memo_lines.join("\n")
}

/// TaskをマークダウンにΑれする
pub fn task_to_markdown(task: &Task) -> String {
    let mut lines = Vec::new();

    // タイトル
    lines.push(format!("# {}", task.title));
    lines.push(String::new());

    // メタデータ
    lines.push("## メタデータ".to_string());
    lines.push(String::new());
    lines.push(format!("- created: {}", task.created));
    lines.push(format!("- updated: {}", task.updated));
    lines.push(format!("- status: {}", task.status));
    lines.push(format!("- priority: {}", task.priority));
    lines.push(format!("- due: {}", task.due));
    lines.push(format!("- assignee: {}", task.assignee));
    lines.push(String::new());

    // サブタスク
    lines.push("## サブタスク".to_string());
    lines.push(String::new());
    if task.sub_tasks.is_empty() {
        lines.push("- [ ] -".to_string());
    } else {
        for st in &task.sub_tasks {
            let checkbox = if st.completed { "[x]" } else { "[ ]" };
            lines.push(format!("- {} {}", checkbox, st.text));
        }
    }
    lines.push(String::new());

    // メモ
    lines.push("## メモ".to_string());
    lines.push(String::new());
    if task.memo.is_empty() {
        lines.push("-".to_string());
    } else {
        lines.push(task.memo.clone());
    }
    lines.push(String::new());

    lines.join("\n")
}
