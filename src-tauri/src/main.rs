// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod parser;

fn main() {
    let new_task = tauri::CustomMenuItem::new("new_task", "新規タスク")
        .accelerator("CmdOrCtrl+N");
    let menu = tauri::Menu::os_default("local-md-kanban")
        .add_submenu(tauri::Submenu::new(
            "Tasks",
            tauri::Menu::new().add_item(new_task),
        ));

    tauri::Builder::default()
        .menu(menu)
        .on_menu_event(|event| {
            if event.menu_item_id() == "new_task" {
                let _ = event.window().emit("menu-new-task", ());
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_tasks,
            commands::save_task,
            commands::create_task,
            commands::delete_task,
            commands::create_task_folder,
            commands::check_git_repo,
            commands::get_git_branches,
            commands::get_current_branch,
            commands::git_sync,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
