#!/usr/bin/env node

/**
 * SuMark スモークテスト
 * アプリが正常に起動し、クラッシュしないことを確認
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const platform = os.platform();
let appPath;

if (platform === 'darwin') {
    appPath = path.join(__dirname, '../src-tauri/target/release/bundle/macos/SuMark.app/Contents/MacOS/SuMark');
} else if (platform === 'win32') {
    appPath = path.join(__dirname, '../src-tauri/target/release/SuMark.exe');
} else {
    appPath = path.join(__dirname, '../src-tauri/target/release/sumark');
}

console.log('🧪 SuMark スモークテスト開始...');
console.log(`📦 アプリケーションパス: ${appPath}`);
console.log('');

const app = spawn(appPath, [], {
    stdio: 'pipe',
    detached: false
});

let timeout;
let passed = false;

// 5秒間クラッシュせずに起動できればテスト合格
timeout = setTimeout(() => {
    console.log('✅ テスト合格: アプリが5秒間安定して動作しました');
    passed = true;
    
    // アプリを終了
    try {
        if (platform === 'darwin' || platform === 'linux') {
            try {
                process.kill(-app.pid, 'SIGTERM');
            } catch (e) {
                // プロセスが既に終了している場合は無視
                app.kill('SIGTERM');
            }
        } else {
            app.kill('SIGTERM');
        }
    } catch (err) {
        // プロセスが既に終了している場合は無視
    }
    
    setTimeout(() => {
        process.exit(0);
    }, 1000);
}, 5000);

app.on('error', (err) => {
    clearTimeout(timeout);
    console.error('❌ テスト失敗: アプリの起動に失敗しました');
    console.error('エラー:', err.message);
    process.exit(1);
});

app.on('exit', (code, signal) => {
    clearTimeout(timeout);
    
    if (!passed) {
        if (signal) {
            console.error(`❌ テスト失敗: アプリがシグナル ${signal} で終了しました`);
        } else if (code !== 0) {
            console.error(`❌ テスト失敗: アプリが異常終了しました (終了コード: ${code})`);
        } else {
            console.error('❌ テスト失敗: アプリが5秒以内に終了しました');
        }
        process.exit(1);
    }
});

app.stdout.on('data', (data) => {
    // アプリの標準出力をキャプチャ（デバッグ用）
    // console.log('APP OUTPUT:', data.toString());
});

app.stderr.on('data', (data) => {
    // エラー出力があってもクラッシュしなければOK
    // console.error('APP ERROR:', data.toString());
});

// プロセス終了時にアプリも終了
process.on('SIGINT', () => {
    clearTimeout(timeout);
    if (app && app.pid) {
        try {
            if (platform === 'darwin' || platform === 'linux') {
                try {
                    process.kill(-app.pid, 'SIGTERM');
                } catch (e) {
                    app.kill('SIGTERM');
                }
            } else {
                app.kill('SIGTERM');
            }
        } catch (err) {
            // プロセスが既に終了している場合は無視
        }
    }
    process.exit(1);
});

console.log('⏳ アプリが起動するまで待機中...');
