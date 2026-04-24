// @ts-check
const { test, expect } = require('./fixtures');

test.describe('Markdown 自動変換テスト', () => {
    test.beforeEach(async ({ app }) => {
        await app.helpers.clearEditor();
    });

    test.describe('見出し変換', () => {
        test('# から h1 に変換される', async ({ app }) => {
            await app.helpers.typeInEditor('# Heading 1');
            await app.helpers.wait(800);

            const hasH1 = await app.helpers.editorContainsTag('h1');
            expect(hasH1).toBe(true);
        });

        test('## から h2 に変換される', async ({ app }) => {
            await app.helpers.typeInEditor('## Heading 2');
            await app.helpers.wait(800);

            const hasH2 = await app.helpers.editorContainsTag('h2');
            expect(hasH2).toBe(true);
        });

        test('### から h3 に変換される', async ({ app }) => {
            await app.helpers.typeInEditor('### Heading 3');
            await app.helpers.wait(800);

            const hasH3 = await app.helpers.editorContainsTag('h3');
            expect(hasH3).toBe(true);
        });

        test('###### まで（h6）対応している', async ({ app }) => {
            await app.helpers.typeInEditor('###### Heading 6');
            await app.helpers.wait(800);

            const hasH6 = await app.helpers.editorContainsTag('h6');
            expect(hasH6).toBe(true);
        });
    });

    test.describe('リスト変換', () => {
        test('- から ul > li に変換される', async ({ app }) => {
            await app.helpers.typeInEditor('- List item');
            await app.helpers.wait(800);

            const hasUl = await app.helpers.editorContainsTag('ul');
            const hasLi = await app.helpers.editorContainsTag('li');
            expect(hasUl).toBe(true);
            expect(hasLi).toBe(true);
        });

        test('* から ul > li に変換される', async ({ app }) => {
            await app.helpers.typeInEditor('* List item');
            await app.helpers.wait(800);

            const hasUl = await app.helpers.editorContainsTag('ul');
            expect(hasUl).toBe(true);
        });

        test('1. から ol > li に変換される', async ({ app }) => {
            await app.helpers.typeInEditor('1. Numbered item');
            await app.helpers.wait(800);

            const hasOl = await app.helpers.editorContainsTag('ol');
            const hasLi = await app.helpers.editorContainsTag('li');
            expect(hasOl).toBe(true);
            expect(hasLi).toBe(true);
        });

        test('[] からタスクリストに変換される', async ({ app }) => {
            await app.helpers.typeInEditor('[] Todo item');
            await app.helpers.wait(800);

            const hasTaskList = await app.helpers.elementExists('#editor ul.contains-task-list');
            expect(hasTaskList).toBe(true);
            const hasCheckbox = await app.helpers.elementExists('#editor input[type="checkbox"]');
            expect(hasCheckbox).toBe(true);
        });

        test('[x] からチェック済みタスクリストに変換される', async ({ app }) => {
            await app.helpers.typeInEditor('[x] Done item');
            await app.helpers.wait(800);

            const hasTaskList = await app.helpers.elementExists('#editor ul.contains-task-list');
            expect(hasTaskList).toBe(true);
            const isChecked = await app.page.locator('#editor input[type="checkbox"]').first().isChecked();
            expect(isChecked).toBe(true);
        });

        test('回帰: ネスト末尾の単独-を含むMarkdown読込で h2 化しない', async ({ app }) => {
            const markdown = '-   1\n    -   2\n        -   3\n            -';

            await app.page.evaluate((md) => {
                if (typeof setMarkdown === 'function') {
                    setMarkdown(md);
                }
            }, markdown);
            await app.helpers.wait(800);

            const h2Count = await app.page.locator('#editor h2').count();
            expect(h2Count).toBe(0);

            const nestedListCount = await app.page.locator('#editor ul ul ul').count();
            expect(nestedListCount).toBeGreaterThan(0);
        });
    });

    test.describe('装飾変換', () => {
        test('**text** から strong に変換される', async ({ app }) => {
            await app.helpers.typeInEditor('**bold**');
            await app.helpers.wait(800);

            const hasStrong = await app.helpers.editorContainsTag('strong');
            expect(hasStrong).toBe(true);
        });

        test('*text* から em に変換される', async ({ app }) => {
            await app.helpers.typeInEditor('*italic*');
            await app.helpers.wait(800);

            const hasEm = await app.helpers.editorContainsTag('em');
            expect(hasEm).toBe(true);
        });

        test('~~text~~ から del に変換される', async ({ app }) => {
            await app.helpers.typeInEditor('~~strikethrough~~');
            await app.helpers.wait(800);

            const hasDel = await app.helpers.editorContainsTag('del');
            expect(hasDel).toBe(true);
        });

        test('`code` から code に変換される', async ({ app }) => {
            await app.helpers.typeInEditor('`inline code`');
            await app.helpers.wait(800);

            const hasCode = await app.helpers.editorContainsTag('code');
            expect(hasCode).toBe(true);
        });
    });

    test.describe('その他の変換', () => {
        test('> から blockquote に変換される', async ({ app }) => {
            await app.helpers.typeInEditor('> Quote');
            await app.helpers.wait(800);

            const hasBlockquote = await app.helpers.editorContainsTag('blockquote');
            expect(hasBlockquote).toBe(true);
        });

        test('引用入力後の改行で引用が終了する', async ({ app }) => {
            await app.helpers.typeInEditor('> Quote text');
            await app.page.keyboard.press('Enter');
            await app.helpers.wait(800);

            // blockquoteは残っている（内容は保持される）
            const blockquoteElements = await app.page.locator('#editor blockquote');
            const bqCount = await blockquoteElements.count();
            expect(bqCount).toBe(1);

            // 引用の後に新しい段落が挿入されている（カーソルが引用の外に移動）
            const pAfterBq = await app.page.locator('#editor blockquote + p');
            const pCount = await pAfterBq.count();
            expect(pCount).toBeGreaterThan(0);
        });

        test('--- から hr に変換される', async ({ app }) => {
            await app.helpers.typeInEditor('---');
            await app.page.keyboard.press('Enter');
            await app.helpers.wait(800);

            const hasHr = await app.helpers.editorContainsTag('hr');
            expect(hasHr).toBe(true);
        });

        test('画像タグの相対パスを asset:// に変換して表示できる', async ({ app }) => {
            const result = await app.page.evaluate(() => {
                const original = '<img src="images/test.png" alt="test" width="100">';
                // Avoid depending on actual filesystem for this test by mocking converter
                const originalConverter = window.testConvertFileSrc;
                window.testConvertFileSrc = () => 'asset://localhost/%2Fmock%2Fimages%2Ftest.png';
                const converted = resolveRelativeImages(original, '/mock');
                window.testConvertFileSrc = originalConverter;
                return converted;
            });

            expect(result).toContain('asset://localhost/%2Fmock%2Fimages%2Ftest.png');
            expect(result).toContain('src="asset://localhost/%2Fmock%2Fimages%2Ftest.png"');
        });

        test('[text](url) から a に変換される', async ({ app }) => {
            await app.helpers.typeInEditor('[link](https://example.com) ');
            await app.helpers.wait(800);

            const hasA = await app.helpers.editorContainsTag('a');
            expect(hasA).toBe(true);
        });

        test('コードブロックに copy/wrap ボタンが表示される', async ({ app }) => {
            const md = '```js\nconsole.log("hello");\n```';
            await app.page.evaluate((markdown) => {
                if (typeof setMarkdown === 'function') setMarkdown(markdown);
            }, md);
            await app.helpers.wait(800);

            const copyButtons = await app.page.locator('#editor .code-block-toolbar .code-copy-btn').count();
            const wrapButtons = await app.page.locator('#editor .code-block-toolbar .code-wrap-btn').count();

            expect(copyButtons).toBeGreaterThan(0);
            expect(wrapButtons).toBeGreaterThan(0);
        });

        test('bash コードブロックにシンタックスハイライトが適用される', async ({ app }) => {
            const md = '```bash\n# comment\necho "hello"\n```';
            await app.page.evaluate((markdown) => {
                if (typeof setMarkdown === 'function') setMarkdown(markdown);
            }, md);
            await app.helpers.wait(800);

            const bashClass = await app.page.locator('#editor pre code.language-bash.hljs').count();
            const commentSpan = await app.page.locator('#editor pre code.language-bash .hljs-comment').count();

            expect(bashClass).toBeGreaterThan(0);
            expect(commentSpan).toBeGreaterThan(0);
        });
    });

    test.describe('数式変換（KaTeX）', () => {
        test('$math$ からインライン数式に変換される', async ({ app }) => {
            await app.helpers.typeInEditor('$E=mc^2$');
            await app.helpers.wait(800);

            const hasMath = await app.helpers.elementExists('.math-inline');
            expect(hasMath).toBe(true);
        });

        test('$$math$$ からディスプレイ数式に変換される', async ({ app }) => {
            await app.helpers.typeInEditor('$$\\int_0^1 x^2 dx$$');
            await app.helpers.wait(800);

            const hasMathDisplay = await app.helpers.elementExists('.math-display');
            expect(hasMathDisplay).toBe(true);
            const mathAttr = await app.page.locator('#editor .math-display').first().getAttribute('data-math');
            const normalized = (mathAttr || '').replace(/\s+/g, '');
            expect(normalized).toContain('\\int_0^1x^2dx');
        });

        test('行頭 $ から始まり $$ で終わるブロック数式もレンダリングされる', async ({ app }) => {
            const markdown = '$\n\\int_0^\\infty f(x) dx = \\lim_{n \\to \\infty} \\sum_{i=1}^{n} f(x_i) \\Delta x\n$$';
            await app.page.evaluate(md => window.setMarkdown(md), markdown);
            await app.helpers.wait(800);

            const mathDisplayCount = await app.page.locator('#editor .math-display').count();
            expect(mathDisplayCount).toBe(1);
            const mathAttr = await app.page.locator('#editor .math-display').first().getAttribute('data-math');
            const normalized = (mathAttr || '').replace(/\s+/g, '');
            expect(normalized).toContain('\\int_0^\\infty');
            expect(normalized).toContain('\\Delta');
        });
    });
});
