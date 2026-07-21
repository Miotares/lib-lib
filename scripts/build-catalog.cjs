const fs = require('fs');
const path = require('path');

// Static generator for lib-lib.org (author-time, committed output — not a bundler step).
// The catalog is client-rendered from books.json, so the raw HTML would otherwise be empty —
// invisible to non-JS crawlers and AI answer engines (GPTBot, ClaudeBot, PerplexityBot, …).
// This pre-renders it, all derived from src/books.json:
//   • index.html   — pre-rendered catalog + ItemList JSON-LD (between marker comments)
//   • sitemap.xml  — the real pages
//   • llms.txt     — site summary + every work
//
// Re-run after editing books.json:  node scripts/build-catalog.cjs  (or: npm run build:catalog). Idempotent.

const SITE = 'https://lib-lib.org';

const projectRoot = path.resolve(__dirname, '..');
const booksJsonPath = path.join(projectRoot, 'src', 'books.json');
const indexPath = path.join(projectRoot, 'index.html');

// --- helpers ----------------------------------------------------------------

// Must stay in sync with slugify() in src/main.js — shared #-anchor links depend on it.
function slugify(title) {
  return title
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function esc(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function has(url) {
  return url && url !== '#' && String(url).trim() !== '';
}

function toAbs(url) {
  if (!has(url)) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return SITE + (url.startsWith('/') ? '' : '/') + url;
}

function langTag(language) {
  return language === 'DE' ? 'de' : String(language || '').toLowerCase();
}

function truncate(text, max) {
  const s = String(text || '').trim();
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
}

// Default runtime sort is date-desc — pre-render in the same order to minimise reflow on hydration.
function sortByDateDesc(books) {
  return [...books].sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));
}

const DOWNLOAD_KINDS = [
  ['pdf', 'PDF', true],
  ['epub', 'EPUB', false],
  ['mp3', 'MP3', false],
  ['youtube', 'YouTube', true],
  ['link', 'Kaufen', true],
];

function downloadButtons(book, indent) {
  const downloads = book.downloads || {};
  return DOWNLOAD_KINDS
    .filter(([key]) => has(downloads[key]))
    .map(([key, label, external]) => {
      const target = external ? ' target="_blank" rel="noopener"' : '';
      return `<a href="${esc(downloads[key])}" class="btn" title="Download ${esc(label)}"${target}>${esc(label)}</a>`;
    })
    .join('\n' + indent);
}

// --- homepage: pre-rendered catalog ----------------------------------------

function buildCard(book) {
  const cover = has(book.coverImage)
    ? `<img src="${esc(book.coverImage)}" alt="${esc(book.title)}" class="book-cover" loading="lazy">`
    : '';

  let translator = '';
  if (book.translator) {
    const name = book.translatorLink
      ? `<a href="${esc(book.translatorLink)}" target="_blank" rel="noopener" class="translator-link">${esc(book.translator)}</a>`
      : esc(book.translator);
    translator = `\n        <span class="book-translator">Übersetzung: ${name}</span>`;
  }

  const links = downloadButtons(book, '          ');

  return `<div class="book-card">
  <div class="book-meta">
    <span>${esc(book.releaseDate)}</span>
    <span>${esc(book.language)}</span>
  </div>
  ${cover}
  <div class="book-content">
    <h2>${esc(book.title)}</h2>
    <div class="book-credits">
      <span class="book-author">${esc(book.author)}</span>
      <span class="book-inline-meta"> • ${esc(book.releaseDate)} • ${esc(book.language)}</span>${translator}
    </div>
    <p class="book-description">${esc(book.description)}</p>
  </div>
  <div class="download-options">
          ${links}
  </div>
</div>`;
}

function bookNode(book) {
  const node = {
    '@type': 'Book',
    name: book.title,
    author: { '@type': 'Person', name: book.author },
    inLanguage: langTag(book.language),
    datePublished: String(book.releaseDate),
    description: book.description,
    url: `${SITE}/#${slugify(book.title)}`,
  };
  if (book.translator) node.translator = { '@type': 'Person', name: book.translator };
  if (has(book.coverImage)) node.image = toAbs(book.coverImage);
  const downloads = book.downloads || {};
  const workExample = [];
  if (has(downloads.pdf)) workExample.push({ '@type': 'Book', bookFormat: 'https://schema.org/EBook', encodingFormat: 'application/pdf', url: toAbs(downloads.pdf) });
  if (has(downloads.epub)) workExample.push({ '@type': 'Book', bookFormat: 'https://schema.org/EBook', encodingFormat: 'application/epub+zip', url: toAbs(downloads.epub) });
  if (has(downloads.mp3)) workExample.push({ '@type': 'Audiobook', url: toAbs(downloads.mp3) });
  if (workExample.length) node.workExample = workExample;
  return node;
}

function buildItemListJsonLd(books) {
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Freie Übersetzungen libertärer Werke',
    numberOfItems: books.length,
    itemListElement: books.map((book, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: bookNode(book),
    })),
  };
  const json = JSON.stringify(itemList, null, 2).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">\n${json}\n</script>`;
}

// --- sitemap + llms.txt -----------------------------------------------------

function buildSitemap() {
  const urls = [
    { loc: `${SITE}/`, priority: '1.0' },
    { loc: `${SITE}/impressum`, priority: '0.4' },
    { loc: `${SITE}/haftung`, priority: '0.4' },
    { loc: `${SITE}/contributoren`, priority: '0.4' },
  ];
  const body = urls
    .map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <priority>${u.priority}</priority>\n  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function buildLlmsTxt(books) {
  const works = sortByDateDesc(books)
    .map((b) => `- [${b.title} (${b.author}, ${b.releaseDate})](${SITE}/#${slugify(b.title)}): ${truncate(b.description, 180)}`)
    .join('\n');
  return `# lib-lib.org

> Freie deutsche Übersetzungen libertärer Werke von Mises, Rothbard, Hoppe, Spooner und weiteren Autoren — kostenlos als PDF, EPUB, Hörbuch (MP3), YouTube oder Kauflink.

lib-lib.org katalogisiert freie, gemeinfreie oder mit Zustimmung veröffentlichte deutschsprachige Übersetzungen libertärer Werke.

## Werke

${works}

## Seiten

- [Impressum](${SITE}/impressum)
- [Haftungsausschluss](${SITE}/haftung)
- [Contributoren](${SITE}/contributoren)
`;
}

// --- index.html marker injection -------------------------------------------

function indentBlock(str, pad) {
  return str.split('\n').map((line) => (line ? pad + line : line)).join('\n');
}

function replaceRegion(html, name, content) {
  const re = new RegExp(`([ \\t]*)(<!-- ${name}:start -->)[\\s\\S]*?(<!-- ${name}:end -->)`);
  const match = html.match(re);
  if (!match) {
    throw new Error(`Marker region "${name}" not found in index.html — cannot inject generated content.`);
  }
  const indent = match[1];
  const body = indentBlock(content, indent);
  return html.replace(re, `${indent}$2\n${body}\n${indent}$3`);
}

// --- run --------------------------------------------------------------------

try {
  const books = JSON.parse(fs.readFileSync(booksJsonPath, 'utf8'));
  const ordered = sortByDateDesc(books);
  const note = '<!-- generated by scripts/build-catalog.cjs — do not edit by hand -->';

  const cards = ordered.map(buildCard).join('\n');
  let html = fs.readFileSync(indexPath, 'utf8');
  html = replaceRegion(html, 'catalog-jsonld', `${note}\n${buildItemListJsonLd(ordered)}`);
  html = replaceRegion(html, 'catalog-list', `${note}\n${cards}`);
  fs.writeFileSync(indexPath, html, 'utf8');

  fs.writeFileSync(path.join(projectRoot, 'sitemap.xml'), buildSitemap(), 'utf8');
  fs.writeFileSync(path.join(projectRoot, 'llms.txt'), buildLlmsTxt(ordered), 'utf8');

  console.log(`Pre-rendered ${books.length} works into index.html (static list + ItemList JSON-LD).`);
  console.log('Regenerated sitemap.xml and llms.txt.');
} catch (error) {
  console.error('build-catalog failed:', error.message);
  process.exit(1);
}
