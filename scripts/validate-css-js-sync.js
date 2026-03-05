#!/usr/bin/env node

/**
 * validate-css-js-sync.js
 *
 * JSで使用しているクラス/ID がCSSで定義されているかチェックする検証スクリプト。
 * pritsコミット時に実行され、CSS-JS の整合性を確保する。
 *
 * 使用法:
 *   npm run test:lint
 *
 *   または pre-commit フックから:
 *   node scripts/validate-css-js-sync.js
 *
 * エラーが見つかった場合は exit code 1 で終了。
 */

const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────
// 設定
// ─────────────────────────────────────────────────

const JS_FILE = path.join(__dirname, '../src/main.js');
const CSS_DIR = path.join(__dirname, '../src/styles');

// 検証を無視するパターン（className, id で使用されない可能性がある）
const IGNORE_PATTERNS = [
  /^[\d]/, // 数字で始まるもの（無効なクラス）
  /^-$/, // ハイフンのみ
  /^_/, // アンダースコアで始まるもの（内部用）
  /-$/, // 末尾がハイフン（動的に生成される部分的なID、例: #mermaid-, #mermaid-diagram-）
  /^language-/, // code highlight の language class（動的）
  /^math-/, // KaTeX 関連（動的に生成される）
  /mermaid/, // Mermaid 動的生成ID（複数のパターン含む）
  /^img-/, // 画像関連の動的クラス
  /^modal/, // モーダル動的クラス
  /^table/, // テーブル関連の動的クラス
  /^paste-/, // ペースト関連の動的クラス
];

// ─────────────────────────────────────────────────
// メイン処理
// ─────────────────────────────────────────────────

function extractJSClasses() {
  if (!fs.existsSync(JS_FILE)) {
    console.error(`❌ ファイルが見つかりません: ${JS_FILE}`);
    process.exit(1);
  }

  const jsContent = fs.readFileSync(JS_FILE, 'utf8');
  const classes = new Set();

  // pattern 1: classList.add('xxx'), classList.remove('xxx')
  const classListPattern = /classList\.(add|remove|toggle)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match;
  while ((match = classListPattern.exec(jsContent)) !== null) {
    const className = match[2];
    if (!shouldIgnore(className)) {
      classes.add('.' + className);
    }
  }

  // pattern 2: className="xxx" または className='xxx'
  const classNamePattern = /className\s*=\s*['"]([^'"]+)['"]/g;
  while ((match = classNamePattern.exec(jsContent)) !== null) {
    const classNames = match[1].split(/\s+/);
    classNames.forEach(cn => {
      if (cn && !shouldIgnore(cn)) {
        classes.add('.' + cn);
      }
    });
  }

  // pattern 3: querySelector('.xxx'), getElementById('xxx')
  const querySelectorPattern = /querySelector\s*\(\s*['"]([#.])([^'"]+)['"]\s*\)/g;
  while ((match = querySelectorPattern.exec(jsContent)) !== null) {
    const symbol = match[1]; // '#' or '.'
    const name = match[2];
    if (!shouldIgnore(name)) {
      classes.add(symbol + name);
    }
  }

  // pattern 4: id="xxx" または id='xxx'
  const idPattern = /id\s*=\s*['"]([^'"]+)['"]/g;
  while ((match = idPattern.exec(jsContent)) !== null) {
    const id = match[1];
    if (!shouldIgnore(id)) {
      classes.add('#' + id);
    }
  }

  // pattern 5: data-xxx attributes (対応するCSSがあるかは任意だが、検出)
  // ここでは省略（必要に応じて追加）

  return classes;
}

function extractCSSSelectors() {
  if (!fs.existsSync(CSS_DIR)) {
    console.error(`❌ ディレクトリが見つかりません: ${CSS_DIR}`);
    process.exit(1);
  }

  // src/styles/ 内の全 .css ファイルを結合して読み込み
  const cssFiles = fs.readdirSync(CSS_DIR).filter(f => f.endsWith('.css'));
  const cssContent = cssFiles.map(f => fs.readFileSync(path.join(CSS_DIR, f), 'utf8')).join('\n');
  const selectors = new Set();

  // パターン: .classname, #id
  const selectorPattern = /(\.[\w-]+|#[\w-]+)(?:\s|,|{|}|:)/g;
  let match;
  while ((match = selectorPattern.exec(cssContent)) !== null) {
    const selector = match[1];
    if (!shouldIgnore(selector.replace(/^[#.]/, ''))) {
      selectors.add(selector);
    }
  }

  return selectors;
}

function shouldIgnore(name) {
  return IGNORE_PATTERNS.some(pattern => pattern.test(name));
}

function validateSync() {
  console.log('📋 CSS-JS同期チェック開始...\n');

  const jsClasses = extractJSClasses();
  const cssSelectors = extractCSSSelectors();

  const missing = [];
  const unused = [];

  // JS で使用されているが CSS に未定義のクラス
  for (const cls of jsClasses) {
    if (!cssSelectors.has(cls)) {
      missing.push(cls);
    }
  }

  // CSS で定義されているが JS で使用されていないセレクタ
  // （これは警告のみ。削除してもいいことを示唆）
  for (const sel of cssSelectors) {
    if (!jsClasses.has(sel)) {
      // TODO: より詳細な検査（HTML固定部のクラスなど）
      // 簡略のため、ここでは警告を出さない
    }
  }

  // ─────────────────────────────────────────────────
  // 結果報告
  // ─────────────────────────────────────────────────

  let hasError = false;

  if (missing.length > 0) {
    hasError = true;
    console.error(`❌ CSS未定義のクラス/ID (${missing.length}個):`);
    missing.forEach(cls => {
      console.error(`   - ${cls}`);
    });
    console.error(
      '\n💡 対応方法:\n' +
      '   1. src/styles/ 内の該当CSSファイルにこれらのクラス/IDを追加\n' +
      '   2. または src/main.js の記述ミスを修正\n'
    );
  } else {
    console.log('✅ CSS-JS整合性OK');
  }

  if (hasError) {
    console.error('\n❌ 検証失敗');
    process.exit(1);
  } else {
    console.log('✅ 検証成功\n');
    process.exit(0);
  }
}

// ─────────────────────────────────────────────────
// エントリーポイント
// ─────────────────────────────────────────────────

validateSync();
