/**
 * mathRender.js - KaTeX Math Rendering
 *
 * renderMathBlocks() を提供する。
 * グローバル依存: editor (DOM), katex (KaTeX library)
 *
 * Phase 1-4 で src/main.js から分離。
 */

// ========== KaTeX Math Rendering ==========
/**
 * Render all math expressions in the editor.
 * This is called after loading a Markdown file to convert $$...$$ and $...$ to rendered math.
 */
function renderMathBlocks() {
    if (typeof katex === 'undefined') {
        return;
    }

    // $$...$$または$...$パターンを含むテキストノードを全て検索
    const walker = document.createTreeWalker(
        editor,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node) {
                // 既に数式要素の中にあれば スキップ
                let parent = node.parentNode;
                while (parent && parent !== editor) {
                    if (parent.classList && (parent.classList.contains('math-display') || parent.classList.contains('math-inline'))) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    parent = parent.parentNode;
                }
                // $パターンを含めば受け入れ
                if (node.textContent.includes('$')) {
                    return NodeFilter.FILTER_ACCEPT;
                }
                return NodeFilter.FILTER_REJECT;
            }
        }
    );

    const nodesToProcess = [];
    let node;
    while (node = walker.nextNode()) {
        nodesToProcess.push(node);
    }

    // ブロック数式（$$...$$）を最初に処理
    nodesToProcess.forEach(textNode => {
        if (!textNode.parentNode || !editor.contains(textNode)) return;
        
        const text = textNode.textContent;
        const displayMathPatterns = [
            /\$\$([\s\S]+?)\$\$/g,
            /\$\s*\n([\s\S]+?)\n\$\$/g,
        ];
        let match;
        const replacements = [];

        displayMathPatterns.forEach((pattern, patternIndex) => {
            while ((match = pattern.exec(text)) !== null) {
                // ブロック数式内での重複マッチングを回避：
                // 2番目の$で開始する可能性があるため
                if (patternIndex === 1 && match.index > 0 && text[match.index - 1] === '$') {
                    continue;
                }
                replacements.push({
                    start: match.index,
                    end: match.index + match[0].length,
                    math: match[1],
                    type: 'display'
                });
            }
        });
        
        if (replacements.length > 0) {
            replacements.sort((a, b) => a.start - b.start);
            const parent = textNode.parentNode;
            const frag = document.createDocumentFragment();
            let lastIndex = 0;

            replacements.forEach(rep => {
                if (rep.start > lastIndex) {
                    frag.appendChild(document.createTextNode(text.substring(lastIndex, rep.start)));
                }

                const div = document.createElement('div');
                div.className = 'math-display';
                div.setAttribute('data-math', rep.math);
                div.setAttribute('contenteditable', 'false');
                try {
                    div.innerHTML = katex.renderToString(rep.math, {displayMode: true, throwOnError: false});
                } catch (err) {
                    console.error('[Math] KaTeX render error:', err);
                    div.textContent = '$$' + rep.math + '$$';
                }
                frag.appendChild(div);
                lastIndex = rep.end;
            });

            if (lastIndex < text.length) {
                frag.appendChild(document.createTextNode(text.substring(lastIndex)));
            }

            if (parent) {
                parent.replaceChild(frag, textNode);
            }
        }
    });

    // インライン数式を処理（ブロック数式の後）
    const walker2 = document.createTreeWalker(
        editor,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node) {
                let parent = node.parentNode;
                while (parent && parent !== editor) {
                    if (parent.classList && (parent.classList.contains('math-display') || parent.classList.contains('math-inline'))) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    parent = parent.parentNode;
                }
                if (node.textContent.includes('$')) {
                    return NodeFilter.FILTER_ACCEPT;
                }
                return NodeFilter.FILTER_REJECT;
            }
        }
    );

    const inlineNodesToProcess = [];
    while (node = walker2.nextNode()) {
        inlineNodesToProcess.push(node);
    }

    inlineNodesToProcess.forEach(textNode => {
        if (!textNode.parentNode || !editor.contains(textNode)) return;
        
        const text = textNode.textContent;
        const inlineMathRegex = /\$([^$\n]+?)\$/g;
        let match;
        const replacements = [];
        
        while ((match = inlineMathRegex.exec(text)) !== null) {
            // $$の一部ではないことを確認
            if (match.index > 0 && text[match.index - 1] === '$') continue;
            if (match.index + match[0].length < text.length && text[match.index + match[0].length] === '$') continue;
            
            replacements.push({
                start: match.index,
                end: match.index + match[0].length,
                math: match[1],
                type: 'inline'
            });
        }
        
        if (replacements.length > 0) {
            replacements.sort((a, b) => a.start - b.start);
            const parent = textNode.parentNode;
            const frag = document.createDocumentFragment();
            let lastIndex = 0;

            replacements.forEach(rep => {
                if (rep.start > lastIndex) {
                    frag.appendChild(document.createTextNode(text.substring(lastIndex, rep.start)));
                }

                const span = document.createElement('span');
                span.className = 'math-inline';
                span.setAttribute('data-math', rep.math);
                span.setAttribute('contenteditable', 'false');
                try {
                    span.innerHTML = katex.renderToString(rep.math, {displayMode: false, throwOnError: false});
                } catch (err) {
                    console.error('[Math] KaTeX render error:', err);
                    span.textContent = '$' + rep.math + '$';
                }
                frag.appendChild(span);
                lastIndex = rep.end;
            });

            if (lastIndex < text.length) {
                frag.appendChild(document.createTextNode(text.substring(lastIndex)));
            }

            if (parent) {
                parent.replaceChild(frag, textNode);
            }
        }
    });

}
