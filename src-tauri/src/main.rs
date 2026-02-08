// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use chrono::{Local, Datelike, Timelike};

// 現在の日付を返すコマンド
#[tauri::command]
fn get_current_date() -> String {
    let now = Local::now();
    format!("{:04}-{:02}-{:02}", now.year(), now.month(), now.day())
}

// 現在の日時を返すコマンド
#[tauri::command]
fn get_current_datetime() -> String {
    let now = Local::now();
    format!(
        "{:04}-{:02}-{:02} {:02}:{:02}:{:02}",
        now.year(),
        now.month(),
        now.day(),
        now.hour(),
        now.minute(),
        now.second()
    )
}

// 現在の時刻を返すコマンド
#[tauri::command]
fn get_current_time() -> String {
    let now = Local::now();
    format!("{:02}:{:02}:{:02}", now.hour(), now.minute(), now.second())
}

#[tauri::command]
fn open_in_browser(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", "", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_current_date,
            get_current_datetime,
            get_current_time,
            open_in_browser
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
