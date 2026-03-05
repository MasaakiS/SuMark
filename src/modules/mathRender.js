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

    // Find all text nodes containing $$...$$ or $...$ patterns
    const walker = document.createTreeWalker(
        editor,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node) {
                // Skip if already inside a math element
                let parent = node.parentNode;
                while (parent && parent !== editor) {
                    if (parent.classList && (parent.classList.contains('math-display') || parent.classList.contains('math-inline'))) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    parent = parent.parentNode;
                }
                // Accept if contains $ pattern
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

    // Process display math first ($$...$$)
    nodesToProcess.forEach(textNode => {
        if (!textNode.parentNode || !editor.contains(textNode)) return;
        
        const text = textNode.textContent;
        const displayMathRegex = /\$\$([^$]+?)\$\$/g;
        let match;
        const replacements = [];

        while ((match = displayMathRegex.exec(text)) !== null) {
            replacements.push({
                start: match.index,
                end: match.index + match[0].length,
                math: match[1],
                type: 'display'
            });
        }
        
        if (replacements.length > 0) {
            // Process replacements in reverse order to maintain indices
            replacements.reverse().forEach(rep => {
                const beforeText = text.substring(0, rep.start);
                const afterText = text.substring(rep.end);
                const parent = textNode.parentNode;
                
                const frag = document.createDocumentFragment();
                if (beforeText) frag.appendChild(document.createTextNode(beforeText));
                
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
                
                const afterNode = document.createTextNode(afterText);
                frag.appendChild(afterNode);
                
                parent.replaceChild(frag, textNode);
                
                // Update textNode reference for next iteration
                if (afterText) {
                    textNode = afterNode;
                }
            });
        }
    });

    // Process inline math ($...$) - need to re-collect nodes after display math processing
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
        const inlineMathRegex = /\$([^$]+?)\$/g;
        let match;
        const replacements = [];
        
        while ((match = inlineMathRegex.exec(text)) !== null) {
            // Make sure it's not part of $$
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
            replacements.reverse().forEach(rep => {
                const beforeText = text.substring(0, rep.start);
                const afterText = text.substring(rep.end);
                const parent = textNode.parentNode;
                
                const frag = document.createDocumentFragment();
                if (beforeText) frag.appendChild(document.createTextNode(beforeText));
                
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
                
                const afterNode = document.createTextNode(afterText);
                frag.appendChild(afterNode);
                
                parent.replaceChild(frag, textNode);
                
                if (afterText) {
                    textNode = afterNode;
                }
            });
        }
    });

}
