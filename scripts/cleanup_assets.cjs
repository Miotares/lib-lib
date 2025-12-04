const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const assetsDir = path.join(projectRoot, 'assets');
const booksJsonPath = path.join(projectRoot, 'src', 'books.json');

try {
    // 1. Get valid authors from books.json
    const booksData = fs.readFileSync(booksJsonPath, 'utf8');
    const books = JSON.parse(booksData);

    // Helper to sanitize filenames (same as in restructure script)
    function sanitize(name) {
        return name.replace(/[\/\\?%*:|"<>]/g, '-').trim();
    }

    const validAuthors = new Set(books.map(b => sanitize(b.author)));
    validAuthors.add('logos'); // Keep logos
    // validAuthors.add('placeholder.svg'); // It's a file, not a dir, but good to keep in mind

    // 2. List directories in assets
    const items = fs.readdirSync(assetsDir);

    items.forEach(item => {
        const itemPath = path.join(assetsDir, item);
        const stats = fs.statSync(itemPath);

        if (stats.isDirectory()) {
            if (!validAuthors.has(item)) {
                console.log(`Removing superfluous directory: ${item}`);
                fs.rmSync(itemPath, { recursive: true, force: true });
            } else {
                console.log(`Keeping valid directory: ${item}`);
            }
        }
    });

    console.log('Cleanup complete.');

} catch (error) {
    console.error('Error during cleanup:', error);
}
