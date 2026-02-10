const { expect } = require('expect-webdriverio');
const TestHelpers = require('../helpers/TestHelpers');

describe('タブ操作テスト', () => {
    beforeEach(async () => {
        await TestHelpers.clearEditor();
        // Close all tabs except the first one
        const tabCount = await TestHelpers.getTabCount();
        for (let i = 1; i < tabCount; i++) {
            await TestHelpers.pressShortcut('w');
            await TestHelpers.wait(300);
        }
    });

    it('初期状態で1つのタブが存在する', async () => {
        const tabCount = await TestHelpers.getTabCount();
        expect(tabCount).toBeGreaterThanOrEqual(1);
    });

    it('新しいタブを作成できる', async () => {
        const initialCount = await TestHelpers.getTabCount();
        await TestHelpers.pressShortcut('n');
        await TestHelpers.wait(500);
        
        const newCount = await TestHelpers.getTabCount();
        expect(newCount).toBe(initialCount + 1);
    });

    it('複数のタブを作成できる', async () => {
        await TestHelpers.pressShortcut('n');
        await TestHelpers.wait(300);
        await TestHelpers.pressShortcut('n');
        await TestHelpers.wait(300);
        await TestHelpers.pressShortcut('n');
        await TestHelpers.wait(300);
        
        const tabCount = await TestHelpers.getTabCount();
        expect(tabCount).toBeGreaterThanOrEqual(4);
    });

    it('タブを切り替えられる', async () => {
        // Create second tab
        await TestHelpers.pressShortcut('n');
        await TestHelpers.wait(500);
        
        // Type in second tab
        await TestHelpers.typeInEditor('Tab 2 content');
        await TestHelpers.wait(500);
        
        // Switch to first tab
        const tabs = await $$('.tab');
        if (tabs.length >= 2) {
            await tabs[0].click();
            await TestHelpers.wait(500);
            
            // Content should be different
            const text = await TestHelpers.getEditorText();
            expect(text.includes('Tab 2 content')).toBe(false);
        }
    });

    it('各タブは独立したコンテンツを持つ', async () => {
        // First tab
        await TestHelpers.typeInEditor('Content 1');
        
        // Create and switch to second tab
        await TestHelpers.pressShortcut('n');
        await TestHelpers.wait(500);
        await TestHelpers.typeInEditor('Content 2');
        
        // Create and switch to third tab
        await TestHelpers.pressShortcut('n');
        await TestHelpers.wait(500);
        await TestHelpers.typeInEditor('Content 3');
        
        // Verify each tab has its own content
        const tabs = await $$('.tab');
        
        if (tabs.length >= 3) {
            // Check third tab (current)
            let text = await TestHelpers.getEditorText();
            expect(text).toContain('Content 3');
            
            // Switch to second tab
            await tabs[1].click();
            await TestHelpers.wait(500);
            text = await TestHelpers.getEditorText();
            expect(text).toContain('Content 2');
            
            // Switch to first tab
            await tabs[0].click();
            await TestHelpers.wait(500);
            text = await TestHelpers.getEditorText();
            expect(text).toContain('Content 1');
        }
    });

    it('タブを閉じることができる', async () => {
        await TestHelpers.pressShortcut('n');
        await TestHelpers.wait(500);
        
        const countBefore = await TestHelpers.getTabCount();
        await TestHelpers.pressShortcut('w');
        await TestHelpers.wait(500);
        
        const countAfter = await TestHelpers.getTabCount();
        expect(countAfter).toBe(countBefore - 1);
    });

    it('タブの×ボタンで閉じることができる', async () => {
        await TestHelpers.pressShortcut('n');
        await TestHelpers.wait(500);
        
        const tabs = await $$('.tab');
        const countBefore = tabs.length;
        
        if (tabs.length > 1) {
            const closeBtn = await tabs[tabs.length - 1].$('.tab-close');
            await closeBtn.click();
            await TestHelpers.wait(500);
            
            const newTabs = await $$('.tab');
            expect(newTabs.length).toBe(countBefore - 1);
        }
    });

    it('最後のタブは閉じられない', async () => {
        // Close all tabs except one
        let tabCount = await TestHelpers.getTabCount();
        while (tabCount > 1) {
            await TestHelpers.pressShortcut('w');
            await TestHelpers.wait(300);
            tabCount = await TestHelpers.getTabCount();
        }
        
        // Try to close the last tab
        await TestHelpers.pressShortcut('w');
        await TestHelpers.wait(500);
        
        const finalCount = await TestHelpers.getTabCount();
        expect(finalCount).toBe(1);
    });

    it('アクティブなタブがハイライトされる', async () => {
        await TestHelpers.pressShortcut('n');
        await TestHelpers.wait(500);
        
        const activeTab = await $('.tab.active');
        await expect(activeTab).toBeDisplayed();
    });

    it('タブタイトルが表示される', async () => {
        const title = await TestHelpers.getActiveTabTitle();
        expect(title).toBeTruthy();
        expect(title.length).toBeGreaterThan(0);
    });

    it('編集したタブには * マークが付く', async () => {
        await TestHelpers.typeInEditor('Modified content');
        await TestHelpers.wait(500);
        
        const title = await TestHelpers.getActiveTabTitle();
        expect(title).toContain('*');
    });
});
