/**
 * E2E テストヘルパーとユーティリティ関数
 */

class TestHelpers {
    /**
     * エディタ要素を取得
     */
    static async getEditor() {
        return await $('#editor');
    }

    /**
     * エディタをクリアする
     */
    static async clearEditor() {
        const editor = await this.getEditor();
        await editor.click();
        
        // Select all and delete
        if (process.platform === 'darwin') {
            await browser.keys(['Command', 'a']);
        } else {
            await browser.keys(['Control', 'a']);
        }
        await browser.keys('Backspace');
        
        await browser.pause(500);
    }

    /**
     * エディタにテキストを入力
     */
    static async typeInEditor(text) {
        const editor = await this.getEditor();
        await editor.click();
        await browser.keys(text.split(''));
        await browser.pause(500);
    }

    /**
     * エディタの HTML コンテンツを取得
     */
    static async getEditorHTML() {
        const editor = await this.getEditor();
        return await editor.getHTML();
    }

    /**
     * エディタのテキストコンテンツを取得
     */
    static async getEditorText() {
        const editor = await this.getEditor();
        return await editor.getText();
    }

    /**
     * キーボードショートカットを実行（Mac/Win 対応）
     */
    static async pressShortcut(key) {
        const modifier = process.platform === 'darwin' ? 'Command' : 'Control';
        await browser.keys([modifier, key]);
        await browser.pause(300);
    }

    /**
     * ツールバーボタンをクリック
     */
    static async clickToolbarButton(buttonId) {
        const button = await $(`#${buttonId}`);
        await button.waitForClickable({ timeout: 5000 });
        await button.click();
        await browser.pause(500);
    }

    /**
     * モーダルが表示されるまで待機
     */
    static async waitForModal() {
        const modal = await $('#modalOverlay');
        await modal.waitForDisplayed({ timeout: 5000 });
    }

    /**
     * モーダルを閉じる
     */
    static async closeModal() {
        const closeBtn = await $('#modalOverlay .close');
        if (await closeBtn.isExisting()) {
            await closeBtn.click();
            await browser.pause(300);
        }
    }

    /**
     * モーダルの入力フィールドに値を設定
     */
    static async setModalField(fieldName, value) {
        const field = await $(`#modal-${fieldName}`);
        await field.setValue(value);
    }

    /**
     * モーダルの OK ボタンをクリック
     */
    static async clickModalOK() {
        const okBtn = await $('#modalOverlay button');
        await okBtn.click();
        await browser.pause(500);
    }

    /**
     * 特定の要素が存在するか確認
     */
    static async elementExists(selector) {
        const element = await $(selector);
        return await element.isExisting();
    }

    /**
     * 要素内の特定のタグが存在するか確認
     */
    static async editorContainsTag(tagName) {
        const editor = await this.getEditor();
        const element = await editor.$$(tagName);
        return element.length > 0;
    }

    /**
     * スクリーンショットを撮影
     */
    static async takeScreenshot(name) {
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const filename = `test/screenshots/${name}_${timestamp}.png`;
        await browser.saveScreenshot(filename);
        return filename;
    }

    /**
     * 指定時間待機
     */
    static async wait(ms) {
        await browser.pause(ms);
    }

    /**
     * テーブルの行数を取得
     */
    static async getTableRowCount() {
        const editor = await this.getEditor();
        const rows = await editor.$$('table tr');
        return rows.length;
    }

    /**
     * テーブルの列数を取得
     */
    static async getTableColumnCount() {
        const editor = await this.getEditor();
        const firstRow = await editor.$('table tr');
        if (await firstRow.isExisting()) {
            const cells = await firstRow.$$('td, th');
            return cells.length;
        }
        return 0;
    }

    /**
     * タブの数を取得
     */
    static async getTabCount() {
        const tabs = await $$('.tab');
        return tabs.length;
    }

    /**
     * アクティブなタブのタイトルを取得
     */
    static async getActiveTabTitle() {
        const activeTab = await $('.tab.active');
        return await activeTab.getText();
    }

    /**
     * 単語数を取得
     */
    static async getWordCount() {
        const wordCount = await $('#wordCount');
        const text = await wordCount.getText();
        return parseInt(text.match(/\d+/)[0], 10);
    }
}

module.exports = TestHelpers;
