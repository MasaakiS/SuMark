// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use chrono::{Local, Datelike, Timelike};
use arboard::{Clipboard, ImageData};
use base64::Engine;
use std::borrow::Cow;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Manager;

/// ウィンドウクローズ許可フラグ（JS側で確認後にセットされる）
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

/// JS側から閉じてOKのフラグを立てるコマンド
#[tauri::command]
fn allow_close() {
    CLOSE_ALLOWED.store(true, Ordering::SeqCst);
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
            open_in_browser,
            copy_image_to_clipboard,
            allow_close
        ])
        .on_window_event(|event| {
            // アプリXボタン: CloseRequested をインターセプトし JS に委譲
            if let tauri::WindowEvent::CloseRequested { api, .. } = event.event() {
                if !CLOSE_ALLOWED.load(Ordering::SeqCst) {
                    api.prevent_close();
                    let _ = event.window().emit("app-close-requested", ());
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            // Cmd+Q など OS 経由のアプリ終了: ExitRequested をインターセプトし JS に委譲
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                if !CLOSE_ALLOWED.load(Ordering::SeqCst) {
                    api.prevent_exit();
                    if let Some(window) = app_handle.get_window("main") {
                        let _ = window.emit("app-close-requested", ());
                    }
                }
            }
        });
}
