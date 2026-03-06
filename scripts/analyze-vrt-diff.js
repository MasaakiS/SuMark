#!/usr/bin/env node

/**
 * VRT 分析・レポート生成スクリプト
 *
 * テスト実行後に差分画像をスキャンし、自動で判定結果を出力する。
 *
 * 使用方法:
 *   npm run test:vrt:analyze           # 差分画像をスキャンしてレポート
 *   npm run test:vrt:analyze -- --json # JSON 形式で出力
 *
 * パイプライン:
 *   npm run test:vrt                    # テスト実行
 *   npm run test:vrt:analyze            # 結果分析
 */

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const pixelmatchModule = require('pixelmatch');
const pixelmatch = pixelmatchModule.default || pixelmatchModule;

// 設定
const DIFF_DIR = path.join(__dirname, '../test/playwright-results/vrt-diffs');
const RESULTS_JSON = path.join(__dirname, '../test/playwright-results/vrt-results.json');
const jsonMode = process.argv.includes('--json');

// 重要度判定の閾値
const SEVERITY = {
    PASS:     { maxPercent: 0,    label: '✅ PASS',    color: '\x1b[32m' },
    MINOR:    { maxPercent: 0.01, label: '🟢 MINOR',   color: '\x1b[32m' },
    WARNING:  { maxPercent: 0.5,  label: '🟡 WARNING',  color: '\x1b[33m' },
    CRITICAL: { maxPercent: 100,  label: '🔴 CRITICAL', color: '\x1b[31m' },
};
const RESET = '\x1b[0m';

/**
 * 差分画像ディレクトリをスキャンして解析
 */
function scanDiffImages() {
    const results = [];

    if (!fs.existsSync(DIFF_DIR)) {
        return results;
    }

    const files = fs.readdirSync(DIFF_DIR);
    const diffFiles = files.filter(f => f.endsWith('-diff.png'));

    for (const diffFile of diffFiles) {
        const testName = diffFile.replace('-diff.png', '').replace(/_/g, ' ');
        const beforeFile = diffFile.replace('-diff.png', '-before.png');
        const afterFile = diffFile.replace('-diff.png', '-after.png');

        const diffPath = path.join(DIFF_DIR, diffFile);
        const beforePath = path.join(DIFF_DIR, beforeFile);
        const afterPath = path.join(DIFF_DIR, afterFile);

        let analysis = { testName, diffFile, severity: 'CRITICAL' };

        try {
            if (fs.existsSync(beforePath) && fs.existsSync(afterPath)) {
                const beforeBuf = fs.readFileSync(beforePath);
                const afterBuf = fs.readFileSync(afterPath);

                const img1 = PNG.sync.read(beforeBuf);
                const img2 = PNG.sync.read(afterBuf);

                if (img1.width !== img2.width || img1.height !== img2.height) {
                    analysis.reason = `サイズ不一致: ${img1.width}x${img1.height} vs ${img2.width}x${img2.height}`;
                    analysis.diffPixels = -1;
                    analysis.diffPercent = 100;
                } else {
                    const { width, height } = img1;
                    const diff = new PNG({ width, height });
                    const numDiffPixels = pixelmatch(
                        img1.data, img2.data, diff.data,
                        width, height, { threshold: 0.15 }
                    );
                    const totalPixels = width * height;
                    const diffPercent = (numDiffPixels / totalPixels) * 100;

                    analysis.diffPixels = numDiffPixels;
                    analysis.totalPixels = totalPixels;
                    analysis.diffPercent = Math.round(diffPercent * 100) / 100;
                    analysis.width = width;
                    analysis.height = height;

                    // 重要度を判定
                    if (diffPercent === 0) analysis.severity = 'PASS';
                    else if (diffPercent <= SEVERITY.MINOR.maxPercent) analysis.severity = 'MINOR';
                    else if (diffPercent <= SEVERITY.WARNING.maxPercent) analysis.severity = 'WARNING';
                    else analysis.severity = 'CRITICAL';

                    // 差分領域の分析
                    analysis.diffRegion = analyzeDiffRegion(img1, img2, width, height);
                }
            } else {
                analysis.reason = '対応する before/after 画像が見つかりません';
            }
        } catch (err) {
            analysis.reason = `分析エラー: ${err.message}`;
        }

        analysis.files = {
            diff: diffPath,
            before: beforePath,
            after: afterPath,
        };

        results.push(analysis);
    }

    return results;
}

/**
 * 差分がどの領域に集中しているか分析
 */
function analyzeDiffRegion(img1, img2, width, height) {
    let minX = width, maxX = 0, minY = height, maxY = 0;
    let count = 0;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const dr = Math.abs(img1.data[idx] - img2.data[idx]);
            const dg = Math.abs(img1.data[idx + 1] - img2.data[idx + 1]);
            const db = Math.abs(img1.data[idx + 2] - img2.data[idx + 2]);

            if (dr + dg + db > 30) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                count++;
            }
        }
    }

    if (count === 0) return null;

    const regionHeight = maxY - minY;
    let position;
    if (minY < height * 0.33) position = '上部';
    else if (minY < height * 0.66) position = '中部';
    else position = '下部';

    return {
        x: minX, y: minY,
        width: maxX - minX, height: regionHeight,
        position,
        spread: regionHeight > height * 0.5 ? '広範囲' : '局所的',
    };
}

/**
 * ターミナル用レポートを出力
 */
function printTerminalReport(results) {
    const timestamp = new Date().toLocaleString('ja-JP');

    console.log('\n' + '═'.repeat(60));
    console.log('  VRT ラウンドトリップ分析レポート');
    console.log('  ' + timestamp);
    console.log('═'.repeat(60));

    if (results.length === 0) {
        console.log('\n  ✅  差分なし — すべてのテストが保存前後で一致しました\n');
        return;
    }

    // サマリー
    const counts = { PASS: 0, MINOR: 0, WARNING: 0, CRITICAL: 0 };
    results.forEach(r => counts[r.severity]++);

    console.log('\n  📊 サマリー:');
    if (counts.CRITICAL > 0) console.log(`     ${SEVERITY.CRITICAL.color}${SEVERITY.CRITICAL.label}: ${counts.CRITICAL} 件${RESET}`);
    if (counts.WARNING > 0)  console.log(`     ${SEVERITY.WARNING.color}${SEVERITY.WARNING.label}: ${counts.WARNING} 件${RESET}`);
    if (counts.MINOR > 0)    console.log(`     ${SEVERITY.MINOR.color}${SEVERITY.MINOR.label}: ${counts.MINOR} 件${RESET}`);
    console.log(`     差分検出合計: ${results.length} 件`);

    // 詳細
    console.log('\n  📋 詳細:');
    console.log('  ' + '─'.repeat(56));

    for (const r of results) {
        const sev = SEVERITY[r.severity];
        console.log(`\n  ${sev.color}${sev.label}${RESET}  ${r.testName}`);

        if (r.diffPixels >= 0) {
            console.log(`     差分: ${r.diffPixels}px (${r.diffPercent}%)`);
        }
        if (r.reason) {
            console.log(`     理由: ${r.reason}`);
        }
        if (r.diffRegion) {
            console.log(`     位置: ${r.diffRegion.position} (${r.diffRegion.spread})`);
            console.log(`     範囲: x=${r.diffRegion.x}, y=${r.diffRegion.y}, ${r.diffRegion.width}x${r.diffRegion.height}px`);
        }
        console.log(`     画像: ${r.files.diff}`);
    }

    console.log('\n  ' + '─'.repeat(56));

    // 推奨アクション
    console.log('\n  💡 推奨アクション:');
    if (counts.CRITICAL > 0) {
        console.log('     🔴 CRITICAL: Markdown ↔ HTML 変換に問題あり。修正が必要です。');
    }
    if (counts.WARNING > 0) {
        console.log('     🟡 WARNING: レンダリングに差異あり。意図的な変更か確認してください。');
    }
    if (counts.MINOR > 0) {
        console.log('     🟢 MINOR: フォントレンダリング等の軽微な差分。許容範囲の可能性が高いです。');
    }

    console.log('\n  差分画像: ' + DIFF_DIR);
    console.log('═'.repeat(60) + '\n');
}

/**
 * JSON 出力
 */
function outputJSON(results) {
    const report = {
        timestamp: new Date().toISOString(),
        summary: {
            total: results.length,
            critical: results.filter(r => r.severity === 'CRITICAL').length,
            warning: results.filter(r => r.severity === 'WARNING').length,
            minor: results.filter(r => r.severity === 'MINOR').length,
            pass: results.filter(r => r.severity === 'PASS').length,
        },
        results: results.map(r => ({
            testName: r.testName,
            severity: r.severity,
            diffPixels: r.diffPixels,
            diffPercent: r.diffPercent,
            region: r.diffRegion,
            reason: r.reason,
        })),
    };

    // ファイルにも保存
    const dir = path.dirname(RESULTS_JSON);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(RESULTS_JSON, JSON.stringify(report, null, 2));

    if (jsonMode) {
        console.log(JSON.stringify(report, null, 2));
    }

    return report;
}

// ─── メイン ────────────────────────────────────────
function main() {
    const results = scanDiffImages();

    if (jsonMode) {
        outputJSON(results);
    } else {
        printTerminalReport(results);
        outputJSON(results);

        // exit code: 差分がある場合は 1
        const hasCritical = results.some(r => r.severity === 'CRITICAL');
        if (hasCritical) {
            process.exit(1);
        }
    }
}

main();
