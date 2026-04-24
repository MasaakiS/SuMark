/**
 * Copilot CLI を使った Markdown 妥当性チェック
 *
 * 使い方:
 *   await validateMarkdownWithCopilot(markdown, { source: '08-roundtrip: H1 test' });
 *
 * 環境変数:
 *   COPILOT_MD_CHECK=1        チェック有効 (既定は無効)
 *   COPILOT_MD_CHECK_MAX=20   1テスト実行あたりの最大チェック回数
 *   COPILOT_MD_MODEL          利用モデル (既定: gpt-5-mini)
 *
 * 通常の `npm run test:e2e` ではチェックは無効。
 * `npm run test:e2e:md-check` を使うと有効になる。
 */

const { spawn, spawnSync } = require('child_process');
const { randomUUID } = require('crypto');

let checkedCount = 0;
const checkedHashes = new Set();
let copilotAvailableCache = null;

function enabled() {
    return process.env.COPILOT_MD_CHECK === '1';
}

function maxChecks() {
    const raw = process.env.COPILOT_MD_CHECK_MAX;
    if (!raw) return 20;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 20;
}

function copilotModel() {
    return process.env.COPILOT_MD_MODEL || 'gpt-5-mini';
}

function copilotSessionId() {
    if (process.env.COPILOT_MD_SESSION_ID) return process.env.COPILOT_MD_SESSION_ID;
    if (!global.__sumarkCopilotMdSessionId) {
        // 1プロセス内の全呼び出しを同一セッションに集約し、CLI履歴の増加を抑える
        global.__sumarkCopilotMdSessionId = randomUUID();
    }
    return global.__sumarkCopilotMdSessionId;
}

function hashString(text) {
    // 外部依存を増やさない軽量ハッシュ
    let h = 0;
    for (let i = 0; i < text.length; i++) {
        h = ((h << 5) - h + text.charCodeAt(i)) | 0;
    }
    return String(h);
}

function ensureCopilotAvailable() {
    if (copilotAvailableCache !== null) return copilotAvailableCache;
    const probe = spawnSync('copilot', ['--version'], {
        encoding: 'utf-8',
        timeout: 15000,
    });
    copilotAvailableCache = probe.status === 0;
    return copilotAvailableCache;
}

async function runCopilotCheck(markdown, source) {
    const prompt = [
        'You are a strict markdown validator.',
        'Check whether the following markdown text is compliant with CommonMark/GFM syntax.',
        'Return exactly one line only:',
        'MD_CHECK_PASS',
        'or',
        'MD_CHECK_FAIL: <short reason>',
        '',
        `Source: ${source || 'unknown'}`,
        '',
        '--- MARKDOWN START ---',
        markdown,
        '--- MARKDOWN END ---',
    ].join('\n');

    await runPrompt(prompt, source, null);
}

async function validateMarkdownWithCopilot(markdown, options = {}) {
    if (!enabled()) return;
    if (typeof markdown !== 'string') return;

    const trimmed = markdown.trim();
    if (!trimmed) return;

    const key = hashString(trimmed);
    if (checkedHashes.has(key)) return;

    if (checkedCount >= maxChecks()) return;

    if (!ensureCopilotAvailable()) {
        throw new Error('[Copilot Markdown Check] `copilot` command is not available.');
    }

    await runCopilotCheck(trimmed, options.source);
    checkedHashes.add(key);
    checkedCount += 1;
}

/**
 * 1. HTML → Markdown の意味的同等性チェック
 *
 * 元のMarkdown (original) と変換後のMarkdown (converted) が
 * 意味的に同等かどうかを Copilot CLI で判定する。
 *
 * 結果フォーマット:
 *   MD_SEMANTIC_MATCH
 *   MD_SEMANTIC_MISMATCH: <理由>
 */
async function checkSemanticEquivalence(original, converted, source) {
    if (!enabled()) return;
    if (typeof original !== 'string' || typeof converted !== 'string') return;

    const key = hashString(original.trim() + '|||' + converted.trim());
    if (checkedHashes.has(key)) return;
    if (checkedCount >= maxChecks()) return;

    if (!ensureCopilotAvailable()) {
        throw new Error('[Copilot Markdown Check] `copilot` command is not available.');
    }

    const prompt = [
        'You are a strict markdown semantic equivalence checker.',
        'Compare the two Markdown texts below.',
        'They are considered semantically equivalent if they represent the same content',
        '(headings, paragraphs, lists, tables, code, links, emphasis, etc.),',
        'even if there are minor formatting differences (e.g., extra blank lines, list marker style).',
        'Ignore whitespace-only differences.',
        'Return exactly one line:',
        'MD_SEMANTIC_MATCH',
        'or',
        'MD_SEMANTIC_MISMATCH: <short reason describing what changed>',
        '',
        `Source: ${source || 'unknown'}`,
        '',
        '--- ORIGINAL MARKDOWN ---',
        original.trim(),
        '--- CONVERTED MARKDOWN ---',
        converted.trim(),
        '--- END ---',
    ].join('\n');

    await runPrompt(prompt, source, key);
}

/**
 * 3. テーブルデータ損失チェック
 *
 * 元のMarkdownテーブル (original) と保存後のMarkdownテーブル (saved) を比較し、
 * セルのデータが失われていないかを Copilot CLI で判定する。
 *
 * 結果フォーマット:
 *   TABLE_CHECK_PASS
 *   TABLE_CHECK_FAIL: <理由>
 */
async function checkTableDataIntegrity(original, saved, source) {
    if (!enabled()) return;
    if (typeof original !== 'string' || typeof saved !== 'string') return;

    const key = hashString('table:' + original.trim() + '|||' + saved.trim());
    if (checkedHashes.has(key)) return;
    if (checkedCount >= maxChecks()) return;

    if (!ensureCopilotAvailable()) {
        throw new Error('[Copilot Markdown Check] `copilot` command is not available.');
    }

    const prompt = [
        'You are a markdown table data integrity checker.',
        'Compare the two Markdown snippets below.',
        'Check if all table cell values from the ORIGINAL are preserved in the SAVED version.',
        'Minor formatting differences (alignment, extra spaces) are acceptable.',
        'Report any missing rows, missing columns, or changed cell values.',
        'Return exactly one line:',
        'TABLE_CHECK_PASS',
        'or',
        'TABLE_CHECK_FAIL: <short description of what data was lost or changed>',
        '',
        `Source: ${source || 'unknown'}`,
        '',
        '--- ORIGINAL MARKDOWN ---',
        original.trim(),
        '--- SAVED MARKDOWN ---',
        saved.trim(),
        '--- END ---',
    ].join('\n');

    await runPrompt(prompt, source, key);
}

/**
 * Copilot CLI にプロンプトを送り、PASS/FAIL を判定する共通実行関数
 */
async function runPrompt(prompt, source, cacheKey) {
    return new Promise((resolve, reject) => {
        const preferredModel = copilotModel();
        const baseArgs = [
            `--resume=${copilotSessionId()}`,
            '-s',
            '-p',
            prompt,
            '--allow-all-tools',
            '--allow-all-paths',
            '--no-color',
            '--reasoning-effort',
            'low',
        ];

        function execute(args, canFallbackModel) {
            const child = spawn('copilot', args, { cwd: process.cwd() });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (d) => { stdout += d; });
            child.stderr.on('data', (d) => { stderr += d; });

            const timer = setTimeout(() => {
                child.kill();
                reject(new Error(`[Copilot Check] timeout at ${source || 'unknown'}`));
            }, 120000);

            child.on('error', (err) => { clearTimeout(timer); reject(err); });

            child.on('close', (code) => {
                clearTimeout(timer);

                const combinedOutput = [stderr.trim(), stdout.trim()].filter(Boolean).join('\n');
                const modelUnavailable = /Model ".+" from --model flag is not available\./.test(combinedOutput);

                if (canFallbackModel && modelUnavailable) {
                    execute(baseArgs, false);
                    return;
                }

                if (code !== 0) {
                    reject(new Error(
                        ['[Copilot Check] CLI failed.', `source: ${source}`, `exit: ${code}`,
                            stderr.trim(), stdout.trim()].filter(Boolean).join('\n')
                    ));
                    return;
                }

                const out = combinedOutput;
                const lines = out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
                const passPatterns = ['MD_SEMANTIC_MATCH', 'TABLE_CHECK_PASS', 'MD_CHECK_PASS'];
                const failPatterns = ['MD_SEMANTIC_MISMATCH:', 'TABLE_CHECK_FAIL:', 'MD_CHECK_FAIL:'];
                const verdict = lines.find((line) => {
                    return passPatterns.some((p) => line.startsWith(p)) || failPatterns.some((p) => line.startsWith(p));
                }) || '';

                if (passPatterns.some((p) => verdict.startsWith(p))) {
                    if (cacheKey) {
                        checkedHashes.add(cacheKey);
                        checkedCount += 1;
                    }
                    resolve();
                    return;
                }

                if (failPatterns.some((p) => verdict.startsWith(p))) {
                    reject(new Error(`[Copilot Check] FAIL at ${source || 'unknown'}\n${verdict}`));
                    return;
                }

                reject(new Error(
                    ['[Copilot Check] unexpected output.', `source: ${source}`, out].join('\n')
                ));
            });
        }

        execute(['--model', preferredModel, ...baseArgs], true);
    });
}

module.exports = {
    validateMarkdownWithCopilot,
    checkSemanticEquivalence,
    checkTableDataIntegrity,
};
