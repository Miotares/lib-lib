# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**lib-lib.org** — a static website that catalogs free German translations of libertarian works (Mises, Rothbard, Hoppe, Spooner, …) and offers them as PDF, EPUB, audiobook (MP3), YouTube, or purchase links. The entire site is vanilla HTML/CSS/JS — no framework, no backend, no tests, no linter.

## Commands

```bash
npm run dev        # Vite dev server for local development
npm run build      # Vite build (see "Deployment" — NOT used in production)
npm run preview    # Preview a Vite build

node scripts/restructure_assets.cjs   # Reorganize asset files per books.json (see below)
node scripts/cleanup_assets.cjs       # Delete asset dirs with no matching author in books.json
```

There is no test or lint setup.

## Deployment (important)

The site is served as **raw source files** via GitHub Pages + Jekyll — `_config.yml` (`permalink: pretty`) and `CNAME` (lib-lib.org) drive this. The HTML pages link `./src/main.js` and `./src/style.css` directly, and footer links are extensionless (`href="impressum"`, resolved by Jekyll pretty permalinks).

Consequences:
- **Do not rely on `vite build`.** There is no `vite.config.*`, the multi-page HTML files (`impressum.html`, `haftung.html`, `contributoren.html`) are not wired into a build, and production serves the source directly. Vite exists only for the local dev server.
- Edits to `src/main.js`, `src/style.css`, `*.html`, or `src/books.json` ship as-is once pushed.

## Data model — `src/books.json`

A single JSON array is the source of truth for all catalog content. `main.js` fetches it at runtime. Each entry:

```json
{
  "releaseDate": "1992",          // year string; sorting parses it as a Date
  "title": "...",
  "author": "...",
  "translator": "...",            // optional
  "translatorLink": "https://...", // optional; renders translator as a link
  "description": "...",            // shown truncated to 150 chars on cards, full in modal
  "coverImage": "/assets/.../cover.jpg",  // "" means none → triggers PDF-cover generation
  "language": "DE",
  "downloads": { "pdf": "...", "epub": "...", "mp3": "...", "youtube": "...", "link": "..." }
}
```

A download value of `""`, `"#"`, or whitespace is treated as "not available" and its button is hidden. `link` is the "Kaufen" (buy) button.

**Adding a book** = add an object to `books.json` + place files under `assets/`. No build step.

## Assets layout

Files live at `assets/<Author>/<Title>/` with canonical names `book.pdf`, `book.epub`, `cover.jpg`. `books.json` references them with leading-slash paths (`/assets/...`). `restructure_assets.cjs` enforces this layout: it reads `books.json`, moves each book's cover/pdf/epub into the author/title dir, renames them to the canonical names, and writes the new paths back into `books.json`.

## Frontend architecture — `src/main.js`

Single module, no build-time bundling of logic. Flow: `init()` fetches `books.json` → builds the author filter → applies state from the URL → renders → opens a deep-linked book if the URL has a hash.

Key behaviors that span the file:
- **URL state**: search/author/sort are mirrored into query params (`?q=&author=&sort=`) via `history.replaceState`; a specific book is deep-linked via `#<slug>`.
- **`slugify(title)`**: maps German umlauts (ä→ae, ö→oe, ü→ue, ß→ss) before stripping. **Shared book links depend on this** — changing it breaks every previously shared `#`-anchor URL.
- **PDF cover generation**: books with empty `coverImage` but a PDF get a cover rendered from page 1 of the PDF via **pdf.js** (loaded from a CDN in `index.html`, not npm). Results are memoized in the in-memory `coverCache` Map keyed by title. This is wired in by **monkey-patching `createBookCard` at the bottom of the file** — be aware the reassigned version is what actually runs.
- **Modal**: per-book detail dialog with focus trap, ESC/backdrop close, and `popstate` handling.
- **View toggle**: grid ⇄ list; forced to list (toggle hidden) on viewports ≤768px.

Book fields are interpolated into `innerHTML` without escaping — `books.json` is trusted, hand-maintained content. Keep it that way (don't treat it as user input), or add escaping if that assumption changes.

## Other pages

`impressum.html`, `haftung.html`, `contributoren.html` are standalone static pages sharing `src/style.css`. They duplicate the header/footer markup from `index.html` — update all of them together when changing shared chrome (the footer's commented-out "Unterstützen"/"Mehr Projekte" links are intentionally disabled across all pages).
