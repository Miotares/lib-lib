// pdf.js worker — the library is loaded (deferred) in index.html; this module runs after it.
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const bookList = document.getElementById('book-list');
const searchInput = document.getElementById('search-input');
const bookModal = document.getElementById('book-modal');
const bookModalBody = bookModal.querySelector('.book-modal-body');
const resultCount = document.getElementById('result-count');
let allBooks = [];
let lastFocusedBeforeModal = null;

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

function createBookCard(book, searchTerm = '') {
  const card = document.createElement('div');
  card.className = 'book-card';

  // Helper to highlight text
  const highlight = (text) => {
    if (!searchTerm || !text) return text;
    // Escape special regex characters in searchTerm to avoid errors
    const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedTerm})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
  };

  // Helper to create button if link exists
  const createLink = (url, label, target = '') => {
    if (!url || url === '#' || url.trim() === '') return '';
    return `<a href="${url}" class="btn" title="Download ${label}" ${target}>${label}</a>`;
  };

  card.innerHTML = `
    <div class="book-meta">
      <span>${book.releaseDate}</span>
      <span>${book.language}</span>
    </div>

    <img src="${book.coverImage}" alt="${book.title}" class="book-cover" loading="lazy">

    <div class="book-content">
      <h2>${highlight(book.title)}</h2>
      <div class="book-credits">
        <span class="book-author">${highlight(book.author)}</span>
        <span class="book-inline-meta"> • ${book.releaseDate} • ${book.language}</span>
        ${book.translator ? (book.translatorLink ? `<span class="book-translator">Übersetzung: <a href="${book.translatorLink}" target="_blank" class="translator-link">${highlight(book.translator)}</a></span>` : `<span class="book-translator">Übersetzung: ${highlight(book.translator)}</span>`) : ''}
      </div>
      <p class="book-description">${book.description.length > 150 ? book.description.substring(0, 150) + '...' : book.description}</p>
    </div>

    <div class="download-options">
      ${createLink(book.downloads.pdf, 'PDF', 'target="_blank"')}
      ${createLink(book.downloads.epub, 'EPUB')}
      ${createLink(book.downloads.mp3, 'MP3')}
      ${createLink(book.downloads.youtube, 'YouTube', 'target="_blank"')}
      ${createLink(book.downloads.link, 'Kaufen', 'target="_blank"')}
      <button class="btn btn-share" title="Link kopieren">Link</button>
    </div>
  `;

  card.querySelector('.btn-share').addEventListener('click', (e) => {
    e.stopPropagation();
    const btn = e.currentTarget;
    const slug = slugify(book.title);
    const url = window.location.origin + window.location.pathname + '#' + slug;
    navigator.clipboard.writeText(url).catch(() => {});
    btn.textContent = 'Kopiert!';
    btn.classList.add('btn-share-copied');
    setTimeout(() => {
      btn.textContent = 'Link';
      btn.classList.remove('btn-share-copied');
    }, 2000);
  });

  card.addEventListener('click', (e) => {
    if (e.target.closest('a, button')) return;
    const slug = slugify(book.title);
    history.replaceState(null, '', window.location.pathname + window.location.search + '#' + slug);
    openBookModal(book);
  });

  return card;
}

function updateResultCount(count) {
  if (!resultCount) return;
  const total = allBooks.length;
  if (total === 0) {
    resultCount.textContent = '';
  } else if (count === total) {
    resultCount.textContent = `${total} Werke`;
  } else {
    resultCount.textContent = `${count} von ${total} Werken`;
  }
}

function renderBookList(booksToRender, searchTerm = '') {
  if (!bookList) return;
  bookList.innerHTML = '';
  updateResultCount(booksToRender.length);

  if (booksToRender.length === 0) {
    bookList.innerHTML = '<div class="empty-state"><strong>Nichts gefunden.</strong>Versuche es mit einem anderen Suchbegriff oder Filter.</div>';
    return;
  }

  booksToRender.forEach(book => {
    const card = createBookCard(book, searchTerm);
    bookList.appendChild(card);
  });
}

// Cache for generated covers
const coverCache = new Map();

function openBookModal(book) {
  const createLink = (url, label, target = '') => {
    if (!url || url === '#' || url.trim() === '') return '';
    return `<a href="${url}" class="btn" title="Download ${label}" ${target}>${label}</a>`;
  };

  // Determine cover source — use cached PDF cover if available
  const bookId = book.title;
  const coverSrc = coverCache.has(bookId) ? coverCache.get(bookId) : (book.coverImage || './assets/placeholder.svg');

  bookModalBody.innerHTML = `
    <div class="modal-layout">
      <div class="modal-cover-col">
        <img src="${coverSrc}" alt="${book.title}" class="modal-cover">
      </div>
      <div class="modal-info-col">
        <h2>${book.title}</h2>
        <div class="book-credits">
          <span class="book-author">${book.author}</span>
          ${book.translator ? (book.translatorLink ? `<span class="book-translator">Übersetzung: <a href="${book.translatorLink}" target="_blank" class="translator-link">${book.translator}</a></span>` : `<span class="book-translator">Übersetzung: ${book.translator}</span>`) : ''}
        </div>
        <div class="modal-meta">${book.releaseDate} · ${book.language}</div>
        <p class="book-description">${book.description}</p>
        <div class="download-options">
          ${createLink(book.downloads.pdf, 'PDF', 'target="_blank"')}
          ${createLink(book.downloads.epub, 'EPUB')}
          ${createLink(book.downloads.mp3, 'MP3')}
          ${createLink(book.downloads.youtube, 'YouTube', 'target="_blank"')}
          ${createLink(book.downloads.link, 'Kaufen', 'target="_blank"')}
          <button class="btn btn-share" title="Link kopieren">Link</button>
        </div>
      </div>
    </div>
  `;

  const hasCoverImage = book.coverImage && book.coverImage.trim() !== '';
  const hasPdf = book.downloads.pdf && book.downloads.pdf !== '#' && book.downloads.pdf.trim() !== '';

  if (!hasCoverImage && hasPdf && !coverCache.has(bookId)) {
    const modalImg = bookModalBody.querySelector('.modal-cover');
    if (modalImg) {
      modalImg.classList.add('loading-cover');
      generatePdfCover(book.downloads.pdf, modalImg, bookId);
    }
  }

  bookModalBody.querySelector('.btn-share').addEventListener('click', (e) => {
    e.stopPropagation();
    const btn = e.currentTarget;
    const slug = slugify(book.title);
    const url = window.location.origin + window.location.pathname + '#' + slug;
    navigator.clipboard.writeText(url).catch(() => {});
    btn.textContent = 'Kopiert!';
    btn.classList.add('btn-share-copied');
    setTimeout(() => {
      btn.textContent = 'Link';
      btn.classList.remove('btn-share-copied');
    }, 2000);
  });

  bookModal.hidden = false;
  bookModal.setAttribute('aria-label', book.title);
  document.body.style.overflow = 'hidden';

  lastFocusedBeforeModal = document.activeElement;
  const closeBtn = bookModal.querySelector('.book-modal-close');
  if (closeBtn) closeBtn.focus();
}

function closeBookModal() {
  bookModal.hidden = true;
  bookModal.removeAttribute('aria-label');
  document.body.style.overflow = '';
  history.replaceState(null, '', window.location.pathname + window.location.search);

  if (lastFocusedBeforeModal && typeof lastFocusedBeforeModal.focus === 'function') {
    lastFocusedBeforeModal.focus();
  }
  lastFocusedBeforeModal = null;
}

function trapModalFocus(e) {
  if (e.key !== 'Tab' || bookModal.hidden) return;
  const focusables = bookModal.querySelectorAll(
    'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function openBookFromHash() {
  const hash = window.location.hash.slice(1);
  if (!hash || allBooks.length === 0) return;
  const book = allBooks.find(b => slugify(b.title) === hash);
  if (book) openBookModal(book);
}

// Modal event listeners
bookModal.querySelector('.book-modal-backdrop').addEventListener('click', closeBookModal);
bookModal.querySelector('.book-modal-close').addEventListener('click', closeBookModal);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !bookModal.hidden) closeBookModal();
  if (e.key === 'Tab' && !bookModal.hidden) trapModalFocus(e);
});
window.addEventListener('popstate', () => {
  if (window.location.hash) {
    openBookFromHash();
  } else {
    bookModal.hidden = true;
    document.body.style.overflow = '';
  }
});

function applyStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const q = params.get('q') || '';
  const author = params.get('author') || 'all';
  const sort = params.get('sort') || 'date-desc';

  if (searchInput) searchInput.value = q;
  if (authorFilter) {
    const exists = Array.from(authorFilter.options).some(o => o.value === author);
    authorFilter.value = exists ? author : 'all';
  }
  if (sortSelect) {
    const exists = Array.from(sortSelect.options).some(o => o.value === sort);
    sortSelect.value = exists ? sort : 'date-desc';
  }
}

function updateUrlState() {
  const params = new URLSearchParams();
  const q = searchInput ? searchInput.value.trim() : '';
  const author = authorFilter ? authorFilter.value : 'all';
  const sort = sortSelect ? sortSelect.value : 'date-desc';

  if (q) params.set('q', q);
  if (author && author !== 'all') params.set('author', author);
  if (sort && sort !== 'date-desc') params.set('sort', sort);

  const qs = params.toString();
  const url = window.location.pathname + (qs ? '?' + qs : '') + (window.location.hash || '');
  history.replaceState(null, '', url);
}

async function init() {
  try {
    const response = await fetch('./src/books.json');
    if (!response.ok) throw new Error('Failed to load books');
    allBooks = await response.json();

    renderAuthorFilter();
    applyStateFromUrl();
    filterBooks();
    openBookFromHash();
  } catch (error) {
    console.error('Error loading books:', error);
    if (bookList) bookList.innerHTML = '<div class="empty-state"><strong>Fehler beim Laden.</strong>Bitte später erneut versuchen.</div>';
  }
}

const authorFilter = document.getElementById('author-filter');
const sortSelect = document.getElementById('sort-select');

function sortBooks(books, mode) {
  const sorted = [...books];
  switch (mode) {
    case 'date-asc':
      return sorted.sort((a, b) => new Date(a.releaseDate) - new Date(b.releaseDate));
    case 'title-asc':
      return sorted.sort((a, b) => a.title.localeCompare(b.title, 'de'));
    case 'date-desc':
    default:
      return sorted.sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));
  }
}

function renderAuthorFilter() {
  if (!authorFilter) return;

  const authorCounts = allBooks.reduce((acc, book) => {
    if (book.author) acc[book.author] = (acc[book.author] || 0) + 1;
    return acc;
  }, {});

  const authors = Object.keys(authorCounts).sort((a, b) => a.localeCompare(b, 'de'));

  authorFilter.innerHTML = `<option value="all">ALLE AUTOREN (${allBooks.length})</option>`;

  authors.forEach(author => {
    const option = document.createElement('option');
    option.value = author;
    option.textContent = `${author} (${authorCounts[author]})`;
    authorFilter.appendChild(option);
  });
}

function filterBooks() {
  const term = searchInput ? searchInput.value.toLowerCase() : '';
  const selectedAuthor = authorFilter ? authorFilter.value : 'all';
  const sortMode = sortSelect ? sortSelect.value : 'date-desc';

  const filtered = allBooks.filter(book => {
    const matchesSearch = book.title.toLowerCase().includes(term) ||
      book.author.toLowerCase().includes(term) ||
      (book.translator && book.translator.toLowerCase().includes(term));

    const matchesAuthor = selectedAuthor === 'all' || book.author === selectedAuthor;

    return matchesSearch && matchesAuthor;
  });

  renderBookList(sortBooks(filtered, sortMode), term);
  updateUrlState();
}

if (searchInput) {
  searchInput.addEventListener('input', filterBooks);
}

if (authorFilter) {
  authorFilter.addEventListener('change', filterBooks);
}

if (sortSelect) {
  sortSelect.addEventListener('change', filterBooks);
}

// View Toggle Logic
const viewToggle = document.getElementById('view-toggle');
if (viewToggle) {
  if (window.innerWidth <= 768) {
    // Mobile: always list view, hide toggle
    bookList.classList.add('view-list');
    viewToggle.style.display = 'none';
  } else {
    viewToggle.addEventListener('click', () => {
      bookList.classList.toggle('view-list');
      const isList = bookList.classList.contains('view-list');
      viewToggle.textContent = isList ? 'RASTERANSICHT' : 'LISTENANSICHT';
    });
  }
}

async function generatePdfCover(pdfUrl, imgElement, bookId) {
  try {
    // Check cache again just in case (though we check before calling)
    if (coverCache.has(bookId)) {
      imgElement.src = coverCache.get(bookId);
      imgElement.classList.remove('loading-cover');
      return;
    }

    const loadingTask = pdfjsLib.getDocument(pdfUrl);
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);

    const scale = 1.5;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
      canvasContext: context,
      viewport: viewport
    };

    await page.render(renderContext).promise;
    const dataUrl = canvas.toDataURL();

    // Store in cache
    coverCache.set(bookId, dataUrl);

    // Update image
    imgElement.src = dataUrl;
    imgElement.classList.remove('loading-cover');
  } catch (error) {
    console.error('Error generating PDF cover:', error);
  }
}

// Hook into render to check for covers
const originalCreateBookCard = createBookCard;
createBookCard = function (book, searchTerm = '') {
  const card = originalCreateBookCard(book, searchTerm);
  const img = card.querySelector('.book-cover');

  // Use title as a simple unique key for now
  const bookId = book.title;

  // Check cache first
  if (coverCache.has(bookId)) {
    img.src = coverCache.get(bookId);
    return card;
  }

  const hasCoverImage = book.coverImage && book.coverImage.trim() !== '';
  const hasPdf = book.downloads.pdf && book.downloads.pdf !== '#' && book.downloads.pdf.trim() !== '';

  if (!hasCoverImage) {
    // Set placeholder by default if no cover image
    img.src = './assets/placeholder.svg';

    if (hasPdf) {
      // If PDF exists, try to generate preview
      img.classList.add('loading-cover');
      generatePdfCover(book.downloads.pdf, img, bookId);
    }
  }

  return card;
};

init();
