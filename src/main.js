const bookList = document.getElementById('book-list');
const searchInput = document.getElementById('search-input');
let allBooks = [];

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
    </div>
  `;

  return card;
}

function renderBookList(booksToRender, searchTerm = '') {
  if (!bookList) return;
  bookList.innerHTML = '';

  if (booksToRender.length === 0) {
    bookList.innerHTML = '<p style="grid-column: 1/-1; text-align: center; font-family: var(--font-mono); color: var(--text-secondary);">KEINE ERGEBNISSE</p>';
    return;
  }

  booksToRender.forEach(book => {
    const card = createBookCard(book, searchTerm);
    bookList.appendChild(card);
  });
}

async function init() {
  try {
    const response = await fetch('./src/books.json');
    if (!response.ok) throw new Error('Failed to load books');
    allBooks = await response.json();

    // Sort by releaseDate descending (newest first)
    allBooks.sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));

    // renderLanguageFilter();
    renderBookList(allBooks);
  } catch (error) {
    console.error('Error loading books:', error);
    if (bookList) bookList.innerHTML = '<p style="text-align:center; color: var(--primary-color);">Fehler beim Laden der Bücher.</p>';
  }
}

/* const languageFilter = document.getElementById('language-filter');

function renderLanguageFilter() {
  if (!languageFilter) return;

  // Get unique languages
  const languages = [...new Set(allBooks.map(book => book.language).filter(Boolean))].sort();

  // Keep "ALLE SPRACHEN" option and append others
  languageFilter.innerHTML = '<option value="all">ALLE SPRACHEN</option>';

  languages.forEach(lang => {
    const option = document.createElement('option');
    option.value = lang;
    option.textContent = lang;
    languageFilter.appendChild(option);
  });
} */

function filterBooks() {
  const term = searchInput ? searchInput.value.toLowerCase() : '';
  // const selectedLang = languageFilter ? languageFilter.value : 'all';

  const filtered = allBooks.filter(book => {
    const matchesSearch = book.title.toLowerCase().includes(term) ||
      book.author.toLowerCase().includes(term) ||
      (book.translator && book.translator.toLowerCase().includes(term));

    // const matchesLang = selectedLang === 'all' || book.language === selectedLang;

    return matchesSearch; // && matchesLang;
  });

  renderBookList(filtered, term);
}

if (searchInput) {
  searchInput.addEventListener('input', filterBooks);
}

/* if (languageFilter) {
  languageFilter.addEventListener('change', filterBooks);
} */

// View Toggle Logic
// View Toggle Logic
const viewToggle = document.getElementById('view-toggle');
if (viewToggle) {
  // Default to list view on mobile
  if (window.innerWidth <= 768) {
    bookList.classList.add('view-list');
    viewToggle.textContent = 'RASTER';
  }

  viewToggle.addEventListener('click', () => {
    bookList.classList.toggle('view-list');
    const isList = bookList.classList.contains('view-list');
    viewToggle.textContent = isList ? 'RASTER' : 'LISTE';
  });
}

// Cache for generated covers
const coverCache = new Map();

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
