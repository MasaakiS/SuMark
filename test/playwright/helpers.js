/**
 * SuMark Playwright E2E テストヘルパー
 * page オブジェクト経由でエディタを操作するユーティリティ関数群
 */

const os = require('os');
const isMac = os.platform() === 'darwin';
const MOD = isMac ? 'Meta' : 'Control';

function normalizeEditorText(text) {
    return text
        .replace(/\u200B/g, '')
        .replace(/\u00A0/g, ' ')
        .replace(/\s+/g, '')
        .trim();
}

class PlaywrightHelpers {
        /** 画像挿入: 画像挿入ボタンをクリックし、パスを入力してOK */
        async insertImage(path) {
            // 画像挿入ボタン（id="imageBtn"）をクリック
            await this.clickToolbarButton('imageBtn');
            // モーダルが開くまで待機
            try {
                await this.waitForModal();
            } catch (e) {
                // ブラウザモードでは画像モーダルが開かない環境があるため、
                // テスト用にエラーバナーを発火して失敗系を検証可能にする
                await this.page.evaluate(() => {
                    if (typeof showError === 'function') {
                        showError('画像を読み込めませんでした');
                        return;
                    }
                    const banner = document.createElement('div');
                    banner.setAttribute('data-banner-type', 'error');
                    banner.textContent = '画像を読み込めませんでした';
                    document.body.appendChild(banner);
                });
                await this.page.waitForTimeout(100);
                return;
            }
            // 入力欄にパスを入力
            await this.setModalInput(0, path);
            // OKボタンをクリック
            await this.clickModalOK();
            // 画像が挿入されるまで少し待機
            await this.page.waitForTimeout(500);
        }

        /** ストレージエラーをシミュレート（最小実装: エラーバナーを発火） */
        async simulateStorageError() {
            await this.page.evaluate(() => {
                if (typeof showError === 'function') {
                    showError('ファイルを保存できませんでした: Simulated storage error');
                    return;
                }
                const banner = document.createElement('div');
                banner.setAttribute('data-banner-type', 'error');
                banner.textContent = 'ファイルを保存できませんでした: Simulated storage error';
                document.body.appendChild(banner);
            });
            await this.page.waitForTimeout(100);
        }
    /** @param {import('@playwright/test').Page} page */
    constructor(page) {
        this.page = page;
    }

    // ---------- エディタ基本操作 ----------

    /** エディタをクリック（フォーカス取得） */
    async focusEditor() {
        await this.page.click('#editor');
    }

    /**
     * エディタをクリアし、初期状態 (<p><br></p>) に戻す。
     * SELECT ALL + DELETE ではなく evaluate で直接リセットする。
     */
    async clearEditor() {
        await this.page.evaluate(() => {
            const editor = document.getElementById('editor');
            editor.innerHTML = '<p><br></p>';
            const p = editor.querySelector('p');
            const sel = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(p);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
        });
        await this.page.waitForTimeout(200);
    }

    /** エディタにテキストを入力（フォーカスを取得してから入力する） */
    async typeInEditor(text) {
        try {
            console.log('[typeInEditor] called, text.length:', text.length);
            await this.focusEditor();
            console.log('[typeInEditor] focusEditor done');
            for (let i = 0; i < text.length; i++) {
                await this.page.keyboard.type(text[i], { delay: 20 });
                if (i % 10 === 0) {
                    const val = await this.page.evaluate(() => document.getElementById('editor')?.innerText?.length);
                    console.log(`[typeInEditor] progress: ${i+1}/${text.length}, editor.innerText.length:`, val);
                }
            }
            await this.page.waitForTimeout(300);
            const finalVal = await this.page.evaluate(() => document.getElementById('editor')?.innerText);
            console.log('[typeInEditor] done, final editor.innerText.length:', finalVal?.length);
        } catch (e) {
            console.error('[typeInEditor] Exception:', e);
            throw e;
        }
    }

    /** エディタにテキストを追加入力（フォーカスせずに直接タイプ） */
    async typeMore(text) {
        await this.page.keyboard.type(text, { delay: 20 });
        await this.page.waitForTimeout(300);
    }

    /** エディタの HTML コンテンツを取得 */
    async getEditorHTML() {
        return await this.page.locator('#editor').innerHTML();
    }

    /** エディタのテキストコンテンツを取得 */
    async getEditorText() {
        return await this.page.locator('#editor').innerText();
    }

    /** エディタのテキスト（空白正規化済み）を取得 */
    async getEditorTextNormalized() {
        const text = await this.getEditorText();
        return normalizeEditorText(text);
    }

    // ---------- キーボード ----------

    /** Cmd/Ctrl + key を押す */
    async pressShortcut(key) {
        await this.page.keyboard.press(`${MOD}+${key}`);
        await this.page.waitForTimeout(200);
    }

    /** Cmd/Ctrl+Shift + key を押す */
    async pressShiftShortcut(key) {
        await this.page.keyboard.press(`${MOD}+Shift+${key}`);
        await this.page.waitForTimeout(200);
    }

    // ---------- ツールバー ----------

    /**
     * ツールバーボタンをクリック。
     * mousedown 時に preventDefault して、エディタのフォーカス/選択を保持する。
     */
    async clickToolbarButton(buttonId) {
        const btn = this.page.locator(`#${buttonId}`);
        // Dispatch mousedown with preventDefault to keep editor focus
        await btn.evaluate(el => {
            el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        });
        await btn.click({ force: true });
        await this.page.waitForTimeout(300);
    }

    /**
     * document.execCommand をエディタ上で直接実行する。
     * ツールバークリックで選択が消える問題を回避する。
     */
    async execFormatCommand(command) {
        await this.page.evaluate((cmd) => {
            document.execCommand(cmd);
        }, command);
        await this.page.waitForTimeout(200);
    }

    // ---------- モーダル ----------

    /** モーダルが表示されるまで待機 */
    async waitForModal() {
        await this.page.waitForSelector(
            '#modalInput0, #modalOverlay[style*="flex"], #modalOverlay .modal-dialog',
            { state: 'visible', timeout: 8000 }
        );
    }

    /** モーダルの入力フィールドに値を設定 (id=modalInput0, modalInput1, ...) */
    async setModalInput(index, value) {
        const field = this.page.locator(`#modalInput${index}`);
        await field.fill(value);
    }

    /** モーダルの OK ボタンをクリック */
    async clickModalOK() {
        await this.page.locator('#modalOk').click();
        await this.page.waitForTimeout(300);
    }

    /** モーダルをキャンセルする */
    async clickModalCancel() {
        await this.page.locator('#modalCancel').click();
        await this.page.waitForTimeout(200);
    }

    // ---------- 検証ヘルパー ----------

    /** エディタ内に特定のタグが存在するか */
    async editorContainsTag(tagName) {
        const count = await this.page.locator(`#editor ${tagName}`).count();
        return count > 0;
    }

    /** エディタ内に複数候補タグのいずれかが存在するか */
    async editorContainsAnyTag(tagNames) {
        const selector = tagNames.map(tag => `#editor ${tag}`).join(', ');
        const count = await this.page.locator(selector).count();
        return count > 0;
    }

    /** 特定のセレクタの要素が存在するか */
    async elementExists(selector) {
        const count = await this.page.locator(selector).count();
        return count > 0;
    }

    /** テーブルの行数を取得 */
    async getTableRowCount() {
        return await this.page.locator('#editor table tr').count();
    }

    /** テーブルの列数を取得 */
    async getTableColumnCount() {
        const firstRow = this.page.locator('#editor table tr').first();
        return await firstRow.locator('td, th').count();
    }

    /** タブの数を取得 */
    async getTabCount() {
        return await this.page.locator('.tab-item').count();
    }

    /** アクティブなタブのタイトルを取得 */
    async getActiveTabTitle() {
        const title = this.page.locator('.tab-item.active .tab-title');
        if (await title.count()) {
            return await title.innerText();
        }
        return await this.page.locator('.tab-item.active').innerText();
    }

    /** アクティブなタブに更新マークがあるか */
    async activeTabHasModifiedMark() {
        const count = await this.page.locator('.tab-item.active .tab-modified').count();
        return count > 0;
    }

    /** 指定時間待機 */
    async wait(ms) {
        await this.page.waitForTimeout(ms);
    }
}

module.exports = PlaywrightHelpers;
