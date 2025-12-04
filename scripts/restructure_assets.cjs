const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.join(projectRoot, 'src');
const assetsDir = path.join(projectRoot, 'assets');
const booksJsonPath = path.join(srcDir, 'books.json');

// Helper to sanitize filenames
function sanitize(name) {
    return name.replace(/[\/\\?%*:|"<>]/g, '-').trim();
}

// Helper to move file
function moveFile(oldPath, newDir, newName) {
    if (!oldPath || oldPath.startsWith('http') || oldPath === '#') return oldPath;

    // Remove leading slash if present for path joining
    const relativePath = oldPath.startsWith('/') ? oldPath.slice(1) : oldPath;
    const absoluteOldPath = path.join(projectRoot, relativePath);

    if (fs.existsSync(absoluteOldPath)) {
        if (!fs.existsSync(newDir)) {
            fs.mkdirSync(newDir, { recursive: true });
        }
        const ext = path.extname(absoluteOldPath);
        const finalName = newName + ext;
        const absoluteNewPath = path.join(newDir, finalName);

        // Move file
        fs.renameSync(absoluteOldPath, absoluteNewPath);
        console.log(`Moved: ${relativePath} -> ${path.relative(projectRoot, absoluteNewPath)}`);

        // Return new relative path for JSON
        return '/assets/' + path.relative(assetsDir, absoluteNewPath);
    } else {
        console.warn(`File not found: ${absoluteOldPath}`);
        return oldPath;
    }
}

try {
    const booksData = fs.readFileSync(booksJsonPath, 'utf8');
    const books = JSON.parse(booksData);

    books.forEach(book => {
        const authorDir = sanitize(book.author);
        const titleDir = sanitize(book.title);
        const targetDir = path.join(assetsDir, authorDir, titleDir);

        // Handle Cover
        if (book.coverImage) {
            book.coverImage = moveFile(book.coverImage, targetDir, 'cover');
        }

        // Handle PDF
        if (book.downloads.pdf) {
            book.downloads.pdf = moveFile(book.downloads.pdf, targetDir, 'book');
        }

        // Handle EPUB
        if (book.downloads.epub) {
            book.downloads.epub = moveFile(book.downloads.epub, targetDir, 'book');
        }
    });

    // Save updated JSON
    fs.writeFileSync(booksJsonPath, JSON.stringify(books, null, 4), 'utf8');
    console.log('Updated books.json');

    // Cleanup empty directories in assets (simple pass)
    // This is a bit risky to do recursively without care, so maybe just leave for manual cleanup or a second pass if needed.
    // For now, let's just focus on moving.

} catch (error) {
    console.error('Error:', error);
}
