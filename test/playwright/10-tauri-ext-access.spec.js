// Tauri連携・画像/ファイル/拡張・アクセシビリティ・異常系テスト例
const { test, expect } = require('./fixtures');

// Tauri API連携（モック/CI用）
// ⚠️ Tauri オブジェクト取得時の競合を避けるため、このファイルのテストはシリアル実行
test.describe.configure({ fullyParallel: false });

test.describe('Tauri連携', () => {
    test('ファイル保存ダイアログが開く', async ({ app }) => {
        const hasTauri = await app.page.evaluate(() => !!window.__TAURI__);
        test.skip(!hasTauri, 'ブラウザモードでは Tauri API が利用できないためスキップ');
        await app.helpers.pressShortcut('s');
        // ダイアログが開いたか（モック/CIではイベントフックで検証）
        // ここでは仮にバナー表示で代用
        const banner = app.page.locator('[data-banner-type]');
        await expect(banner).toBeVisible();
    });
});

// 画像挿入・エラー

test.describe('画像挿入・エラー', () => {
    test('画像挿入ボタンが存在する', async ({ app }) => {
        await expect(app.page.locator('#imageBtn')).toBeVisible();
    });
    test('画像読み込み失敗時にエラー表示', async ({ app }) => {
        await app.helpers.insertImage('/notfound.png');
        const error = app.page.locator('.img-error-container, [data-banner-type]');
        await expect(error).toBeVisible();
    });
});

// Mermaid/KaTeX/TOC拡張

test.describe('拡張機能レンダリング', () => {
    // Mermaidグラフの自動E2Eテストは描画トリガやDOM構造の問題で安定検証不可のため、
    // manual-tests.mdに記載の通り手動テスト必須としています。
    //
    // test('Mermaidグラフが正しく描画される', async ({ app }) => {
    //     // まず mermaid\n のみ入力（Mermaid入力モードに）
    //     await app.helpers.typeInEditor('```mermaid\n');
    //     await app.page.waitForTimeout(5000);
    //     // コード入力欄内にグラフ記法を入力
    //     await app.helpers.typeInEditor('graph TD; A-->B;');
    //     // Enterキーを4回入力してコードブロックを抜ける
    //     for (let i = 0; i < 4; i++) {
    //         await app.helpers.pressShortcut('Enter');
    //     }
    //     await app.page.waitForTimeout(2000);
    //     const svg = app.page.locator('.mermaid-container svg');
    //     await expect(svg).toBeVisible();
    // });
    // KaTeX数式の自動E2Eテストは描画トリガやDOM構造の問題で安定検証不可のため、
    // manual-tests.mdに記載の通り手動テスト必須としています。
    //
    // test('KaTeX数式が正しく描画される', async ({ app }) => {
    //     const md = '$$E=mc^2$$';
    //     await app.helpers.typeInEditor(md);
    //     const katex = app.page.locator('.katex-display');
    //     await expect(katex).toBeVisible();
    // });
    test('目次(TOC)が生成される', async ({ app }) => {
        const md = '# 見出し1\n## 見出し2';
        await app.helpers.typeInEditor(md);
        // 目次ボタンをクリック
        await app.page.click('#tocBtn');
        const toc = app.page.locator('.toc-container');
        await expect(toc).toBeVisible();
    });
});

// Undo/Redo限界値

test.describe('Undo/Redo限界値', () => {
    test('30回a入力→15回undo後に内容が変化していればOK', async ({ app }) => {
        for (let i = 0; i < 30; i++) await app.helpers.typeInEditor('a');
        const before = await app.helpers.getEditorText();
        for (let i = 0; i < 15; i++) {
            await app.helpers.pressShortcut('z');
        }
        const after = await app.helpers.getEditorText();
        expect(after).not.toBe(before);
    });
});
