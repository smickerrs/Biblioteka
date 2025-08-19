// Biblioteka Smyka JavaScript mit IndexedDB
class BookManager {
    constructor() {
        this.dbName = 'BibliotekaSmykaDB';
        this.dbVersion = 1;
        this.db = null;
        this.books = [];
        this.authorSortType = 'alphabetical';
        this.init();
    }

    async init() {
        await this.initDatabase();
        await this.loadBooks();
        this.setupEventListeners();
        this.renderBooks();
        this.renderAuthors();
        this.renderWishlist();
    }

    // IndexedDB initialisieren
    async initDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('Fehler beim Öffnen der Datenbank:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('IndexedDB erfolgreich geöffnet');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Bücher-Store erstellen
                if (!db.objectStoreNames.contains('books')) {
                    const bookStore = db.createObjectStore('books', { keyPath: 'id' });
                    bookStore.createIndex('author', 'author', { unique: false });
                    bookStore.createIndex('status', 'status', { unique: false });
                    console.log('Bücher-Store erstellt');
                }
            };
        });
    }

    // Bücher aus IndexedDB laden
    async loadBooks() {
        if (!this.db) {
            console.error('Datenbank nicht initialisiert');
            return;
        }

        try {
            const transaction = this.db.transaction(['books'], 'readonly');
            const store = transaction.objectStore('books');
            const request = store.getAll();

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    if (request.result.length > 0) {
                        this.books = request.result;
                        console.log(`${this.books.length} Bücher aus IndexedDB geladen`);
                    } else {
                        // Versuche Migration von LocalStorage
                        this.books = this.migrateFromLocalStorage();
                        if (this.books.length > 0) {
                            this.saveBooks(); // In IndexedDB speichern
                        } else {
                            this.books = this.getDefaultBooks();
                        }
                        console.log(`${this.books.length} Bücher geladen (Migration abgeschlossen)`);
                    }
                    resolve();
                };

                request.onerror = () => {
                    console.error('Fehler beim Laden der Bücher:', request.error);
                    this.books = this.getDefaultBooks();
                    resolve();
                };
            });
        } catch (error) {
            console.error('Fehler beim Laden der Bücher:', error);
            this.books = this.getDefaultBooks();
        }
    }

    // Migration von LocalStorage zu IndexedDB
    migrateFromLocalStorage() {
        try {
            const savedBooks = localStorage.getItem('books');
            if (savedBooks) {
                const books = JSON.parse(savedBooks);
                console.log(`${books.length} Bücher von LocalStorage migriert`);
                // LocalStorage-Daten löschen
                localStorage.removeItem('books');
                return books;
            }
        } catch (error) {
            console.error('Fehler bei der Migration:', error);
        }
        return [];
    }

    // Bücher in IndexedDB speichern
    async saveBooks() {
        if (!this.db) {
            console.error('Datenbank nicht initialisiert');
            return;
        }

        try {
            const transaction = this.db.transaction(['books'], 'readwrite');
            const store = transaction.objectStore('books');
            
            // Alle alten Bücher löschen
            await store.clear();
            
            // Alle neuen Bücher hinzufügen
            for (const book of this.books) {
                await store.add(book);
            }
            
            console.log('Bücher erfolgreich gespeichert');
        } catch (error) {
            console.error('Fehler beim Speichern der Bücher:', error);
        }
    }

    // Standard-Bücher für den Start
    getDefaultBooks() {
        return [
            {
                id: 1,
                title: "Władca Pierścieni",
                author: "J.R.R. Tolkien",
                price: 24.99,
                image: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=300&fit=crop",
                status: "owned"
            },
            {
                id: 2,
                title: "Harry Potter i Kamień Filozoficzny",
                author: "J.K. Rowling",
                price: 19.99,
                image: "https://images.unsplash.com/photo-1603871165848-0aa92c869fa1?w=400&h=300&fit=crop",
                status: "owned"
            },
            {
                id: 3,
                title: "Rok 1984",
                author: "George Orwell",
                price: 12.99,
                image: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&h=300&fit=crop",
                status: "wishlist"
            }
        ];
    }

    // Event-Listener einrichten
    setupEventListeners() {
        document.getElementById('add-book-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addBook();
        });
        
        // Autoren-Liste beim Öffnen des Modals aktualisieren
        document.getElementById('add-book-modal').addEventListener('click', (e) => {
            if (e.target.id === 'add-book-modal') {
                this.closeAddBookModal();
            }
        });
    }

    // Autoren-Änderung behandeln
    handleAuthorChange() {
        const select = document.getElementById('book-author-select');
        const newAuthorInput = document.getElementById('book-author-new');
        
        if (select.value === 'new') {
            // Neuen Autor hinzufügen
            newAuthorInput.style.display = 'block';
            newAuthorInput.required = true;
            newAuthorInput.focus();
        } else {
            // Vorhandenen Autor ausgewählt
            newAuthorInput.style.display = 'none';
            newAuthorInput.required = false;
        }
    }

    // Autoren-Liste für das Formular aktualisieren
    updateAuthorSelect() {
        const select = document.getElementById('book-author-select');
        if (!select) return;
        
        // Aktuelle Auswahl speichern
        const currentValue = select.value;
        
        // Alle Optionen außer der ersten löschen
        select.innerHTML = '<option value="">-- Wybierz autora --</option>';
        
        // Vorhandene Autoren hinzufügen
        const authors = this.getAuthorsWithBookCount();
        authors.forEach(author => {
            const option = document.createElement('option');
            option.value = author.name;
            option.textContent = author.name;
            select.appendChild(option);
        });
        
        // "Neuen Autor hinzufügen" Option
        const newAuthorOption = document.createElement('option');
        newAuthorOption.value = 'new';
        newAuthorOption.textContent = '+ Dodaj nowego autora';
        select.appendChild(newAuthorOption);
        
        // Vorherige Auswahl wiederherstellen (falls möglich)
        if (currentValue && currentValue !== 'new') {
            select.value = currentValue;
        }
    }

    // Neues Buch hinzufügen
    async addBook() {
        const title = document.getElementById('book-title').value;
        const authorSelect = document.getElementById('book-author-select');
        const newAuthorInput = document.getElementById('book-author-new');
        const price = parseFloat(document.getElementById('book-price').value) || 0;
        const image = document.getElementById('book-image').value || this.getDefaultBookImage();
        const status = document.getElementById('book-status').value;

        // Autor bestimmen
        let author;
        if (authorSelect.value === 'new') {
            author = newAuthorInput.value.trim();
            if (!author) {
                alert('Proszę podać nazwę nowego autora.');
                newAuthorInput.focus();
                return;
            }
        } else {
            author = authorSelect.value.trim();
            if (!author) {
                alert('Proszę wybrać autora.');
                authorSelect.focus();
                return;
            }
        }

        const newBook = {
            id: Date.now(),
            title: title.trim(),
            author: author,
            price: price,
            image: image,
            status: status
        };

        this.books.push(newBook);
        await this.saveBooks();
        this.renderBooks();
        this.renderAuthors();
        this.renderWishlist();
        this.closeAddBookModal();
        this.resetForm();
    }

    // Standard-Buchbild wenn keins angegeben
    getDefaultBookImage() {
        const defaultImages = [
            "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=300&fit=crop",
            "https://images.unsplash.com/photo-1603871165848-0aa92c869fa1?w=400&h=300&fit=crop",
            "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&h=300&fit=crop",
            "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=300&fit=crop"
        ];
        return defaultImages[Math.floor(Math.random() * defaultImages.length)];
    }

    // Buch-Status ändern
    async toggleBookStatus(bookId) {
        const book = this.books.find(b => b.id === bookId);
        if (book) {
            book.status = book.status === 'owned' ? 'wishlist' : 'owned';
            await this.saveBooks();
            this.renderBooks();
            this.renderAuthors();
            this.renderWishlist();
        }
    }

    // Buch löschen
    async deleteBook(bookId) {
        if (confirm('Czy na pewno chcesz usunąć tę książkę?')) {
            this.books = this.books.filter(b => b.id !== bookId);
            await this.saveBooks();
            this.renderBooks();
            this.renderAuthors();
            this.renderWishlist();
        }
    }

    // Alle Bücher rendern
    renderBooks() {
        const container = document.getElementById('books-container');
        if (!container) return;

        if (this.books.length === 0) {
            container.innerHTML = '<div class="loading">Brak książek. Dodaj swoją pierwszą książkę!</div>';
            return;
        }

        container.innerHTML = this.books.map(book => this.createBookCard(book)).join('');
    }

    // Wunschliste rendern
    renderWishlist() {
        const container = document.getElementById('wishlist-container');
        if (!container) return;

        const wishlistBooks = this.books.filter(book => book.status === 'wishlist');
        
        if (wishlistBooks.length === 0) {
            container.innerHTML = '<div class="loading">Twoja lista życzeń jest pusta. Dodaj książki, które chcesz kupić!</div>';
            return;
        }

        container.innerHTML = wishlistBooks.map(book => this.createBookCard(book)).join('');
    }

    // Autoren rendern
    renderAuthors() {
        const container = document.getElementById('authors-container');
        if (!container) return;

        const authors = this.getAuthorsWithBookCount();
        
        if (authors.length === 0) {
            container.innerHTML = '<div class="loading">Brak autorów.</div>';
            return;
        }

        container.innerHTML = authors.map(author => `
            <div class="author-item">
                <div class="author-info" onclick="bookManager.showAuthorBooks('${author.name}')">
                    <span class="author-name">${author.name}</span>
                    <span class="author-book-count">${author.bookCount} książka${author.bookCount > 1 ? 'i' : author.bookCount === 1 ? '' : ''}</span>
                </div>
                <button class="edit-author-btn" onclick="bookManager.editAuthor('${author.name}')" title="Edytuj nazwę autora">
                    ✏️
                </button>
            </div>
        `).join('');
    }

    // Autorennamen bearbeiten
    async editAuthor(oldAuthorName) {
        const newAuthorName = prompt(`Edytuj nazwę autora "${oldAuthorName}":`, oldAuthorName);
        
        if (newAuthorName && newAuthorName.trim() && newAuthorName.trim() !== oldAuthorName) {
            const trimmedNewName = newAuthorName.trim();
            
            // Alle Bücher dieses Autors aktualisieren
            let updatedCount = 0;
            this.books.forEach(book => {
                if (book.author === oldAuthorName) {
                    book.author = trimmedNewName;
                    updatedCount++;
                }
            });
            
            if (updatedCount > 0) {
                // Bücher speichern
                await this.saveBooks();
                
                // Alle Ansichten aktualisieren
                this.renderBooks();
                this.renderAuthors();
                this.renderWishlist();
                
                alert(`Zaktualizowano ${updatedCount} książkę/książki autora "${oldAuthorName}" na "${trimmedNewName}"`);
            }
        }
    }

    // Bücher eines bestimmten Autors anzeigen
    showAuthorBooks(authorName) {
        console.log('showAuthorBooks aufgerufen mit:', authorName);
        console.log('Alle Bücher:', this.books);
        
        const authorBooks = this.books.filter(book => book.author === authorName);
        console.log('Gefilterte Bücher für', authorName, ':', authorBooks);
        
        if (authorBooks.length === 0) {
            alert(`Nie znaleziono książek autorstwa ${authorName}.`);
            return;
        }

        // Tab zu "Alle Bücher" wechseln (korrekte ID verwenden)
        showTab('all-books');
        
        // Bücher filtern und anzeigen
        const container = document.getElementById('books-container');
        console.log('Container gefunden:', container);
        
        if (container) {
            const htmlContent = `
                <div class="author-filter-header">
                    <h3>📚 Książki autorstwa ${authorName}</h3>
                    <button onclick="bookManager.showAllAuthors()" class="show-all-btn">← Powrót do autorów</button>
                </div>
                <div class="books-grid">
                    ${authorBooks.map(book => this.createBookCard(book)).join('')}
                </div>
            `;
            console.log('HTML Content:', htmlContent);
            container.innerHTML = htmlContent;
        }
    }

    // Zurück zu allen Autoren
    showAllAuthors() {
        // Tab zu "Autoren" wechseln
        showTab('authors');
        // Autoren neu rendern
        this.renderAuthors();
    }

    // Autoren sortieren
    sortAuthors(sortType) {
        this.authorSortType = sortType;
        
        // Sortier-Buttons aktualisieren
        document.querySelectorAll('.sort-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
        
        // Autoren neu rendern
        this.renderAuthors();
    }

    // Autoren mit Buchanzahl sammeln
    getAuthorsWithBookCount() {
        const authorCounts = {};
        
        this.books.forEach(book => {
            if (authorCounts[book.author]) {
                authorCounts[book.author]++;
            } else {
                authorCounts[book.author] = 1;
            }
        });

        const authors = Object.entries(authorCounts)
            .map(([name, bookCount]) => ({ name, bookCount }));

        // Sortierung basierend auf ausgewähltem Typ
        if (this.authorSortType === 'bookCount') {
            return authors.sort((a, b) => b.bookCount - a.bookCount); // Nach Buchanzahl (meiste zuerst)
        } else {
            return authors.sort((a, b) => a.name.localeCompare(b.name, 'pl')); // Alphabetisch
        }
    }

    // Buch-Karte erstellen
    createBookCard(book) {
        const statusText = book.status === 'owned' ? 'Kupiona' : 'Lista życzeń';
        const statusClass = book.status === 'owned' ? 'status-owned' : 'status-wishlist';
        const toggleText = book.status === 'owned' ? 'Przenieś do listy życzeń' : 'Oznacz jako kupioną';

        return `
            <div class="book-card">
                <img src="${book.image}" alt="${book.title}" class="book-image" 
                     onerror="this.src='https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=300&fit=crop'">
                <h3 class="book-title">${book.title}</h3>
                <p class="book-author">autor: ${book.author}</p>
                <div class="book-price">${book.price > 0 ? book.price.toFixed(2) + ' zł' : 'Cena nieznana'}</div>
                <span class="book-status ${statusClass}">${statusText}</span>
                <button class="status-toggle" onclick="bookManager.toggleBookStatus(${book.id})">
                    ${toggleText}
                </button>
                <button class="status-toggle" onclick="bookManager.deleteBook(${book.id})" 
                        style="background: #e74c3c; margin-top: 10px;">
                    Usuń książkę
                </button>
            </div>
        `;
    }

    // Modal öffnen
    openAddBookModal() {
        document.getElementById('add-book-modal').style.display = 'block';
        this.updateAuthorSelect(); // Autoren-Liste aktualisieren
    }

    // Modal schließen
    closeAddBookModal() {
        document.getElementById('add-book-modal').style.display = 'none';
    }

    // Formular zurücksetzen
    resetForm() {
        document.getElementById('add-book-form').reset();
    }

    // Datenbank-Informationen anzeigen
    async showDatabaseInfo() {
        if (!this.db) {
            alert('Datenbank nicht initialisiert');
            return;
        }

        try {
            const transaction = this.db.transaction(['books'], 'readonly');
            const store = transaction.objectStore('books');
            const countRequest = store.count();

            countRequest.onsuccess = () => {
                const bookCount = countRequest.result;
                const authorCount = this.getAuthorsWithBookCount().length;
                
                alert(`📊 Informacje o bazie danych:\n\n` +
                      `📚 Liczba książek: ${bookCount}\n` +
                      `✍️ Liczba autorów: ${authorCount}\n` +
                      `💾 Typ bazy: IndexedDB\n` +
                      `🚀 Wydajność: Wysoka (do 50GB)`);
            };
        } catch (error) {
            console.error('Fehler beim Abrufen der Datenbank-Informationen:', error);
        }
    }
}

// Tab-Funktionalität
function showTab(tabName, event = null) {
    console.log('showTab aufgerufen mit:', tabName);
    
    // Alle Tab-Inhalte ausblenden
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
        content.classList.remove('active');
        console.log('Tab deaktiviert:', content.id);
    });

    // Alle Tab-Buttons deaktivieren
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => btn.classList.remove('active'));

    // Gewählten Tab aktivieren
    const targetTab = document.getElementById(tabName);
    if (targetTab) {
        targetTab.classList.add('active');
        console.log('Tab aktiviert:', tabName);
    } else {
        console.error('Tab nicht gefunden:', tabName);
    }
    
    // Tab-Button aktivieren (falls ein Event übergeben wurde)
    if (event && event.target) {
        event.target.classList.add('active');
    } else {
        // Fallback: Button über Tab-Name finden
        const targetButton = document.querySelector(`[onclick*="showTab('${tabName}')"]`);
        if (targetButton) {
            targetButton.classList.add('active');
        }
    }
}

// Modal-Funktionen (global verfügbar)
function openAddBookModal() {
    bookManager.openAddBookModal();
}

function closeAddBookModal() {
    bookManager.closeAddBookModal();
}

// App initialisieren wenn DOM geladen ist
document.addEventListener('DOMContentLoaded', () => {
    window.bookManager = new BookManager();
});

// Modal schließen wenn außerhalb geklickt wird
window.addEventListener('click', (event) => {
    const modal = document.getElementById('add-book-modal');
    if (event.target === modal) {
        closeAddBookModal();
    }
});

// Tastatur-Shortcuts
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeAddBookModal();
    }
    if (event.ctrlKey && event.key === 'n') {
        event.preventDefault();
        openAddBookModal();
    }
});
