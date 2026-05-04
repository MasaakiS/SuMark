// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use chrono::{Local, Datelike, Timelike};
use arboard::{Clipboard, ImageData};
use base64::Engine;
use std::borrow::Cow;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::Manager;

/// Files passed via command-line arguments (e.g. drag-onto-icon, "Open with")
struct InitialFiles(Mutex<Vec<String>>);

static CLOSE_ALLOWED: AtomicBool = AtomicBool::new(false);

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
fn copy_image_to_clipboard(image_data: String) -> Result<(), String> {
    // Decode base64 PNG data
    let png_bytes = base64::engine::general_purpose::STANDARD
        .decode(&image_data)
        .map_err(|e| format!("Base64 decode error: {}", e))?;

    // Decode PNG to RGBA pixels
    let img = image::load_from_memory_with_format(&png_bytes, image::ImageFormat::Png)
        .map_err(|e| format!("PNG decode error: {}", e))?;
    let rgba = img.to_rgba8();
    let (width, height) = rgba.dimensions();
    let pixels = rgba.into_raw();

    // Copy to clipboard
    let mut clipboard = Clipboard::new()
        .map_err(|e| format!("Clipboard init error: {}", e))?;
    clipboard
        .set_image(ImageData {
            width: width as usize,
            height: height as usize,
            bytes: Cow::Owned(pixels),
        })
        .map_err(|e| format!("Clipboard set image error: {}", e))?;

    Ok(())
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

/// Returns file paths passed as command-line arguments and clears the internal list.
/// The frontend calls this once after initialization to open any files the OS requested.
#[tauri::command]
fn get_initial_files(state: tauri::State<InitialFiles>) -> Vec<String> {
    let mut files = state.0.lock().unwrap();
    let result = files.clone();
    files.clear();
    result
}

#[tauri::command]
fn allow_close() {
    CLOSE_ALLOWED.store(true, Ordering::SeqCst);
}

#[tauri::command]
fn exit_app(app_handle: tauri::AppHandle) {
    app_handle.exit(0);
}

fn main() {
    // Collect file paths from command-line arguments (skip argv[0] = program name,
    // and any flags starting with '-').  These are opened by the frontend after init.
    let file_args: Vec<String> = std::env::args()
        .skip(1)
        .filter(|arg| !arg.starts_with('-'))
        .collect();

    tauri::Builder::default()
        .manage(InitialFiles(Mutex::new(file_args)))
        .invoke_handler(tauri::generate_handler![
            get_current_date,
            get_current_datetime,
            get_current_time,
            open_in_browser,
            copy_image_to_clipboard,
            allow_close,
            exit_app,
            get_initial_files
        ])
        .on_window_event(|event| {
            // アプリXボタン: 常に防いで JS に委譲
            if let tauri::WindowEvent::CloseRequested { api, .. } = event.event() {
                if CLOSE_ALLOWED.load(Ordering::SeqCst) {
                    return;
                }
                api.prevent_close();
                let _ = event.window().app_handle().emit_all("app-close-requested", ());
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            // Cmd+Q など OS 経由のアプリ終了: 常に防いで JS に委譲
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                if CLOSE_ALLOWED.load(Ordering::SeqCst) {
                    return;
                }
                api.prevent_exit();
                let _ = app_handle.emit_all("app-close-requested", ());
            }
        });
}
