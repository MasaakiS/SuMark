const { expect } = require('expect-webdriverio');
const TestHelpers = require('../helpers/TestHelpers');

describe('Markdown 自動変換テスト', () => {
    beforeEach(async () => {
        await TestHelpers.clearEditor();
    });

    describe('見出し変換', () => {
        it('# から h1 に変換される', async () => {
            await TestHelpers.typeInEditor('# Heading 1');
            await browser.keys('Space');
            await TestHelpers.wait(500);
            
            const hasH1 = await TestHelpers.editorContainsTag('h1');
            expect(hasH1).toBe(true);
        });

        it('## から h2 に変換される', async () => {
            await TestHelpers.typeInEditor('## Heading 2');
            await browser.keys('Space');
            await TestHelpers.wait(500);
            
            const hasH2 = await TestHelpers.editorContainsTag('h2');
            expect(hasH2).toBe(true);
        });

        it('### から h3 に変換される', async () => {
            await TestHelpers.typeInEditor('### Heading 3');
            await browser.keys('Space');
            await TestHelpers.wait(500);
            
            const hasH3 = await TestHelpers.editorContainsTag('h3');
            expect(hasH3).toBe(true);
        });

        it('###### まで（h6）対応している', async () => {
            await TestHelpers.typeInEditor('###### Heading 6');
            await browser.keys('Space');
            await TestHelpers.wait(500);
            
            const hasH6 = await TestHelpers.editorContainsTag('h6');
            expect(hasH6).toBe(true);
        });
    });

    describe('リスト変換', () => {
        it('- から ul > li に変換される', async () => {
            await TestHelpers.typeInEditor('- List item');
            await browser.keys('Space');
            await TestHelpers.wait(500);
            
            const hasUl = await TestHelpers.editorContainsTag('ul');
            const hasLi = await TestHelpers.editorContainsTag('li');
            expect(hasUl).toBe(true);
            expect(hasLi).toBe(true);
        });

        it('* から ul > li に変換される', async () => {
            await TestHelpers.typeInEditor('* List item');
            await browser.keys('Space');
            await TestHelpers.wait(500);
            
            const hasUl = await TestHelpers.editorContainsTag('ul');
            expect(hasUl).toBe(true);
        });

        it('1. から ol > li に変換される', async () => {
            await TestHelpers.typeInEditor('1. Numbered item');
            await browser.keys('Space');
            await TestHelpers.wait(500);
            
            const hasOl = await TestHelpers.editorContainsTag('ol');
            const hasLi = await TestHelpers.editorContainsTag('li');
            expect(hasOl).toBe(true);
            expect(hasLi).toBe(true);
        });

        it('- [ ] からタスクリストに変換される', async () => {
            await TestHelpers.typeInEditor('- [ ] Todo item');
            await browser.keys('Space');
            await TestHelpers.wait(500);
            
            const hasCheckbox = await TestHelpers.elementExists('input[type="checkbox"]');
            expect(hasCheckbox).toBe(true);
        });

        it('- [x] からチェック済みタスクリストに変換される', async () => {
            await TestHelpers.typeInEditor('- [x] Done item');
            await browser.keys('Space');
            await TestHelpers.wait(500);
            
            const checkbox = await $('input[type="checkbox"]');
            const isChecked = await checkbox.isSelected();
            expect(isChecked).toBe(true);
        });
    });

    describe('装飾変換', () => {
        it('**text** から strong に変換される', async () => {
            await TestHelpers.typeInEditor('**bold**');
            await browser.keys('Space');
            await TestHelpers.wait(500);
            
            const hasStrong = await TestHelpers.editorContainsTag('strong');
            expect(hasStrong).toBe(true);
        });

        it('*text* から em に変換される', async () => {
            await TestHelpers.typeInEditor('*italic*');
            await browser.keys('Space');
            await TestHelpers.wait(500);
            
            const hasEm = await TestHelpers.editorContainsTag('em');
            expect(hasEm).toBe(true);
        });

        it('~~text~~ から del に変換される', async () => {
            await TestHelpers.typeInEditor('~~strikethrough~~');
            await browser.keys('Space');
            await TestHelpers.wait(500);
            
            const hasDel = await TestHelpers.editorContainsTag('del');
            expect(hasDel).toBe(true);
        });

        it('`code` から code に変換される', async () => {
            await TestHelpers.typeInEditor('`inline code`');
            await browser.keys('Space');
            await TestHelpers.wait(500);
            
            const hasCode = await TestHelpers.editorContainsTag('code');
            expect(hasCode).toBe(true);
        });
    });

    describe('その他の変換', () => {
        it('> から blockquote に変換される', async () => {
            await TestHelpers.typeInEditor('> Quote');
            await browser.keys('Space');
            await TestHelpers.wait(500);
            
            const hasBlockquote = await TestHelpers.editorContainsTag('blockquote');
            expect(hasBlockquote).toBe(true);
        });

        it('--- から hr に変換される', async () => {
            await TestHelpers.typeInEditor('---');
            await browser.keys('Enter');
            await TestHelpers.wait(500);
            
            const hasHr = await TestHelpers.editorContainsTag('hr');
            expect(hasHr).toBe(true);
        });

        it('[text](url) から a に変換される', async () => {
            await TestHelpers.typeInEditor('[link](https://example.com)');
            await browser.keys('Space');
            await TestHelpers.wait(500);
            
            const hasA = await TestHelpers.editorContainsTag('a');
            expect(hasA).toBe(true);
        });
    });

    describe('数式変換（KaTeX）', () => {
        it('$math$ からインライン数式に変換される', async () => {
            await TestHelpers.typeInEditor('$E=mc^2$');
            await browser.keys('Space');
            await TestHelpers.wait(500);
            
            const hasMath = await TestHelpers.elementExists('.math-inline');
            expect(hasMath).toBe(true);
        });

        it('$$math$$ からディスプレイ数式に変換される', async () => {
            await TestHelpers.typeInEditor('$$\\int_0^1 x^2 dx$$');
            await browser.keys('Enter');
            await TestHelpers.wait(500);
            
            const hasMathDisplay = await TestHelpers.elementExists('.math-display');
            expect(hasMathDisplay).toBe(true);
        });
    });
});
