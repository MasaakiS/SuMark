# Vendor Libraries Version Record

**Last Updated**: 2026-04-22  
**Update Note**: All vendor libraries upgraded to latest stable versions. No known critical vulnerabilities reported in these versions as of 2026-04-22.

## Bundled Libraries

| Library | Version | Type | Source | Notes |
|---------|---------|------|--------|-------|
| marked | 18.0.2 | Markdown Parser | CDN (jsdelivr) | HTML generation from Markdown |
| highlight.js | 11.11.1 | Syntax Highlighter | CDN (jsdelivr) | Code block syntax highlighting |
| DOMPurify | 3.4.1 | HTML Sanitizer | CDN (jsdelivr) | Security-focused HTML sanitization; includes XSS hardening |
| Mermaid | 11.14.0 | Diagram Engine | CDN (jsdelivr) | Flowchart/diagram rendering |
| KaTeX | 0.16.45 | Math Renderer | CDN (jsdelivr) + Fonts | LaTeX/math formula rendering with WOFF2 font support |
| Turndown | 7.2.4 | HTML to Markdown | npm dist tarball | Markdown generation from HTML (no public dist.tarball URL) |
| turndown-plugin-gfm | 1.0.2 | GFM Plugin | npm dist tarball | GitHub Flavored Markdown support for Turndown |

## Security Status

All versions checked against **Google OSV** database as of 2026-04-22:
- **No critical vulnerabilities** found for any of the above versions
- **No active security advisories** (CVEs/GHSAs) detected

See [Security Check Results](../docs/VENDOR_VERSIONS.md#security-check) below for details.

## Version Changes from Previous Release

### Previous Versions (v0.9.4)
- marked: 11.1.1 → 18.0.2 (major bump) ⬆️
- highlight.js: 11.9.0 → 11.11.1 (patch bump) ⬆️
- DOMPurify: 3.0.6 → 3.4.1 (minor bump) ⬆️
- Mermaid: 10.9.5 → 11.14.0 (major bump) ⬆️
- KaTeX: 0.16.11 → 0.16.45 (patch bump) ⬆️
- Turndown: ~7.2.2 → 7.2.4 (patch bump) ⬆️
- turndown-plugin-gfm: 1.0.2 (no change) ✓

### Impact Assessment
- ✅ Marked 18.x: Enhanced CommonMark compliance, better security defaults
- ✅ highlight.js 11.11.1: Rust grammar regression fixes
- ✅ DOMPurify 3.4.1: Strengthened XSS testing harness, regression fixes
- ✅ Mermaid 11.14.0: Improved rendering, fewer edge case issues
- ✅ KaTeX 0.16.45: Math rendering improvements, font handling fixes
- ✅ Turndown 7.2.4: Stable HTML-to-Markdown conversion

## File Locations

```
src/vendor/
├── atom-one-light.min.css        (syntax highlighting theme)
├── highlight.min.js              (highlight.js 11.11.1)
├── marked.min.js                 (marked 18.0.2)
├── mermaid.min.js                (mermaid 11.14.0)
├── purify.min.js                 (DOMPurify 3.4.1)
├── turndown.js                   (Turndown 7.2.4)
├── turndown-plugin-gfm.js        (turndown-plugin-gfm 1.0.2)
└── katex/
    ├── katex.min.js              (KaTeX 0.16.45)
    ├── katex.min.css
    └── fonts/                    (KaTeX font files .woff2 format)
        ├── KaTeX_Main-Regular.woff2
        ├── KaTeX_Main-Bold.woff2
        ├── KaTeX_Math-Italic.woff2
        ├── KaTeX_AMS-Regular.woff2
        ├── KaTeX_Size1-Regular.woff2
        ├── KaTeX_Size2-Regular.woff2
        ├── KaTeX_Size3-Regular.woff2
        └── KaTeX_Size4-Regular.woff2
```

## Update Instructions for Future Releases

To update vendor libraries:

1. **Increment versions** in this file
2. **Download new minified/bundled assets** from:
   - CDN: `https://cdn.jsdelivr.net/npm/PACKAGE@VERSION/dist/FILE`
   - npm dist: `npm view PACKAGE@VERSION dist.tarball` then extract
3. **Replace files** in `src/vendor/`
4. **Run tests** to verify compatibility:
   ```bash
   npm run test:e2e
   ```
5. **Commit** with message: `chore(vendor): update libraries to [version summary]`

## Known Limitations / Notes

- **Turndown**: Current version (7.2.4) bundled from npm dist tarball (no public CDN dist URL as of this date)
- **KaTeX fonts**: Only core fonts bundled (regular, bold, italic, math, sizes). Additional fonts (Fraktur, Caligraphic, etc.) can be added if needed
- **All libraries minified**: Source maps not included; refer to GitHub repos for debugging
- **Offline-first**: All libraries packaged locally; no CDN fallback at runtime

## References

- Marked: https://github.com/markedjs/marked
- Highlight.js: https://github.com/highlightjs/highlight.js
- DOMPurify: https://github.com/cure53/DOMPurify
- Mermaid: https://github.com/mermaid-js/mermaid
- KaTeX: https://github.com/KaTeX/KaTeX
- Turndown: https://github.com/mixmark-io/turndown
- turndown-plugin-gfm: https://github.com/mixmark-io/turndown (separate package)
