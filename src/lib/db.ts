/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Book, BookVersion, BookFile, BookChapter, PlaybackState, HistoryEntry } from '../types';

const DB_NAME = 'audiobook_player_db';
const DB_VERSION = 1;

class AudiobookDatabase {
  private db: IDBDatabase | null = null;

  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB failed to open');
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = request.result;

        // Books Store
        if (!db.objectStoreNames.contains('books')) {
          db.createObjectStore('books', { keyPath: 'id', autoIncrement: true });
        }

        // Versions Store
        if (!db.objectStoreNames.contains('versions')) {
          const versionStore = db.createObjectStore('versions', { keyPath: 'id', autoIncrement: true });
          versionStore.createIndex('bookId', 'bookId', { unique: false });
        }

        // Files Store
        if (!db.objectStoreNames.contains('files')) {
          const fileStore = db.createObjectStore('files', { keyPath: 'id', autoIncrement: true });
          fileStore.createIndex('versionId', 'versionId', { unique: false });
        }

        // Chapters Store
        if (!db.objectStoreNames.contains('chapters')) {
          const chapterStore = db.createObjectStore('chapters', { keyPath: 'id', autoIncrement: true });
          chapterStore.createIndex('fileId', 'fileId', { unique: false });
        }

        // Playback State Store
        if (!db.objectStoreNames.contains('playback_state')) {
          db.createObjectStore('playback_state', { keyPath: 'bookId' });
        }

        // History Store
        if (!db.objectStoreNames.contains('history')) {
          const historyStore = db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
          historyStore.createIndex('bookId', 'bookId', { unique: false });
        }
      };
    });
  }

  // --- Transactions ---
  private async getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    const db = await this.init();
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  // --- Books ---
  async getBooks(): Promise<Book[]> {
    const store = await this.getStore('books');
    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  async getBookById(id: number): Promise<Book | undefined> {
    const store = await this.getStore('books');
    return new Promise((resolve) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async saveBook(book: Omit<Book, 'id'> & { id?: number }): Promise<number> {
    const store = await this.getStore('books', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(book);
      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteBook(id: number): Promise<void> {
    const store = await this.getStore('books', 'readwrite');
    return new Promise((resolve) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
    });
  }

  // --- Versions ---
  async getVersions(bookId: number): Promise<BookVersion[]> {
    const db = await this.init();
    const transaction = db.transaction('versions', 'readonly');
    const store = transaction.objectStore('versions');
    const index = store.index('bookId');
    return new Promise((resolve) => {
      const request = index.getAll(bookId);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  async saveVersion(version: Omit<BookVersion, 'id'> & { id?: number }): Promise<number> {
    const store = await this.getStore('versions', 'readwrite');
    return new Promise((resolve) => {
      const request = store.put(version);
      request.onsuccess = () => resolve(request.result as number);
    });
  }

  // --- Files ---
  async getFiles(versionId: number): Promise<BookFile[]> {
    const db = await this.init();
    const transaction = db.transaction('files', 'readonly');
    const store = transaction.objectStore('files');
    const index = store.index('versionId');
    return new Promise((resolve) => {
      const request = index.getAll(versionId);
      request.onsuccess = () => {
        const sorted = (request.result || []).sort((a, b) => a.orderIndex - b.orderIndex);
        resolve(sorted);
      };
    });
  }

  async saveFile(file: Omit<BookFile, 'id'> & { id?: number }): Promise<number> {
    const store = await this.getStore('files', 'readwrite');
    return new Promise((resolve) => {
      const request = store.put(file);
      request.onsuccess = () => resolve(request.result as number);
    });
  }

  async updateFileDuration(id: number, durationMs: number): Promise<void> {
    const store = await this.getStore('files', 'readwrite');
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const file = getReq.result;
      if (file) {
        file.durationMs = durationMs;
        store.put(file);
      }
    };
  }

  async updateFileOrder(filesData: { id: number; orderIndex: number }[]): Promise<void> {
    const store = await this.getStore('files', 'readwrite');
    for (const item of filesData) {
      const getReq = store.get(item.id);
      getReq.onsuccess = () => {
        const file = getReq.result;
        if (file) {
          file.orderIndex = item.orderIndex;
          store.put(file);
        }
      };
    }
  }

  // --- Chapters ---
  async getChapters(fileId: number): Promise<BookChapter[]> {
    const db = await this.init();
    const transaction = db.transaction('chapters', 'readonly');
    const store = transaction.objectStore('chapters');
    const index = store.index('fileId');
    return new Promise((resolve) => {
      const request = index.getAll(fileId);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  async saveChapter(chapter: Omit<BookChapter, 'id'> & { id?: number }): Promise<number> {
    const store = await this.getStore('chapters', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(chapter);
      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  }

  async updateChapterTitle(chapterId: number, title: string): Promise<void> {
    const store = await this.getStore('chapters', 'readwrite');
    return new Promise((resolve) => {
      const getReq = store.get(chapterId);
      getReq.onsuccess = () => {
        const item = getReq.result;
        if (item) {
          item.title = title;
          store.put(item);
        }
        resolve();
      };
      getReq.onerror = () => resolve();
    });
  }

  async deleteChapter(chapterId: number): Promise<void> {
    const store = await this.getStore('chapters', 'readwrite');
    return new Promise((resolve) => {
      const request = store.delete(chapterId);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  }

  async saveChaptersBulk(fileId: number, chapters: Omit<BookChapter, 'id' | 'fileId'>[]): Promise<void> {
    // Failsafe clear existing
    const db = await this.init();
    const transaction = db.transaction('chapters', 'readwrite');
    const store = transaction.objectStore('chapters');
    const index = store.index('fileId');

    const selectReq = index.getAll(fileId);
    selectReq.onsuccess = () => {
      const existing = selectReq.result || [];
      for (const item of existing) {
        store.delete(item.id);
      }
      for (const ch of chapters) {
        store.add({ ...ch, fileId });
      }
    };
  }

  // --- Playback State ---
  async getPlaybackState(bookId: number): Promise<PlaybackState | null> {
    const store = await this.getStore('playback_state');
    return new Promise((resolve) => {
      const request = store.get(bookId);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async savePlaybackState(state: PlaybackState): Promise<void> {
    const store = await this.getStore('playback_state', 'readwrite');
    return new Promise((resolve) => {
      const request = store.put(state);
      request.onsuccess = () => resolve();
    });
  }

  async getLastPlayedBookId(): Promise<number | null> {
    const store = await this.getStore('playback_state');
    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const list = request.result || [];
        if (list.length === 0) return resolve(null);
        list.sort((a, b) => b.lastPlayedTs - a.lastPlayedTs);
        resolve(list[0].bookId);
      };
    });
  }

  // --- History ---
  async getHistory(bookId: number): Promise<HistoryEntry[]> {
    const db = await this.init();
    const transaction = db.transaction('history', 'readonly');
    const store = transaction.objectStore('history');
    const index = store.index('bookId');
    return new Promise((resolve) => {
      const request = index.getAll(bookId);
      request.onsuccess = () => {
        const sorted = (request.result || []).sort((a, b) => b.timestamp - a.timestamp);
        resolve(sorted);
      };
    });
  }

  async saveHistoryEntry(entry: Omit<HistoryEntry, 'id'>): Promise<number> {
    const store = await this.getStore('history', 'readwrite');
    return new Promise((resolve) => {
      const request = store.put(entry);
      request.onsuccess = () => resolve(request.result as number);
    });
  }

  async clearDatabase(): Promise<void> {
    const db = await this.init();
    const stores = ['books', 'versions', 'files', 'chapters', 'playback_state', 'history'];
    const transaction = db.transaction(stores, 'readwrite');
    stores.forEach((s) => transaction.objectStore(s).clear());
  }

  // Add default demo books to make the app interactive on startup
  async loadDemoBooksIfEmpty(): Promise<void> {
    const books = await this.getBooks();
    if (books.length > 0) return; // DB already has items.

    console.log('[DB] DB is empty! Populating beautiful demo audiobooks...');

    // Demo Audiobook 1: The Time Machine by H.G. Wells
    const bookId1 = await this.saveBook({
      folderName: 'The Time Machine (H.G. Wells)',
      path: '/books/time_machine',
      author: 'H.G. Wells',
      coverUrl: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=400&auto=format&fit=crop&q=80',
    });

    // Version 1: Algieba Voice (Classic Narrator)
    const verId1A = await this.saveVersion({
      bookId: bookId1,
      voiceActor: 'Algieba Voice',
    });

    const fileId1A_1 = await this.saveFile({
      versionId: verId1A,
      fileName: 'The Time Machine - Part 01_Algieba.mp3',
      filePath: 'DEMO_NARRATOR_ALGIEBA_PART1',
      partNumber: 1,
      orderIndex: 0,
      durationMs: 180000, // 3 minutes demo
    });

    const fileId1A_2 = await this.saveFile({
      versionId: verId1A,
      fileName: 'The Time Machine - Part 02_Algieba.mp3',
      filePath: 'DEMO_NARRATOR_ALGIEBA_PART2',
      partNumber: 2,
      orderIndex: 1,
      durationMs: 240000, // 4 minutes
    });

    // Save Chapters for Version 1
    await this.saveChaptersBulk(fileId1A_1, [
      { title: 'Introduction of the Time Traveller', startTimeMs: 0, endTimeMs: 45000 },
      { title: 'The Scientific Discussion', startTimeMs: 45000, endTimeMs: 120000 },
      { title: 'Demonstrating the Model', startTimeMs: 120000, endTimeMs: 180000 },
    ]);

    await this.saveChaptersBulk(fileId1A_2, [
      { title: 'The Traveler Returns', startTimeMs: 0, endTimeMs: 90000 },
      { title: 'Journey to the Year 802,701', startTimeMs: 90000, endTimeMs: 240000 },
    ]);

    // Version 2: Umbriel Reader (Dynamic Narrator)
    const verId1B = await this.saveVersion({
      bookId: bookId1,
      voiceActor: 'Umbriel Reader',
    });

    const fileId1B_1 = await this.saveFile({
      versionId: verId1B,
      fileName: 'The Time Machine - Part 01_Umbriel.mp3',
      filePath: 'DEMO_NARRATOR_UMBRIEL_PART1',
      partNumber: 1,
      orderIndex: 0,
      durationMs: 200000,
    });

    await this.saveChaptersBulk(fileId1B_1, [
      { title: 'Intro: The Fourth Dimension Explained', startTimeMs: 0, endTimeMs: 100000 },
      { title: 'The Time Machine Mechanism', startTimeMs: 100000, endTimeMs: 200000 },
    ]);


    // Demo Audiobook 2: The Invisible Man by H.G. Wells
    const bookId2 = await this.saveBook({
      folderName: 'The Invisible Man (H.G. Wells)',
      path: '/books/invisible_man',
      author: 'H.G. Wells',
      coverUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&auto=format&fit=crop&q=80',
    });

    // Version 1: Sir Cedric (Deep Voice)
    const verId2A = await this.saveVersion({
      bookId: bookId2,
      voiceActor: 'Sir Cedric',
    });

    const fileId2A_1 = await this.saveFile({
      versionId: verId2A,
      fileName: 'The Invisible Man - Part 01_Cedric.mp3',
      filePath: 'DEMO_NARRATOR_CEDRIC_PART1',
      partNumber: 1,
      orderIndex: 0,
      durationMs: 300000, // 5 minutes
    });

    await this.saveChaptersBulk(fileId2A_1, [
      { title: 'A Strange Guest at Iping', startTimeMs: 0, endTimeMs: 150000 },
      { title: 'The Bandaged Stranger Unveiled', startTimeMs: 150000, endTimeMs: 300000 },
    ]);

    // Version 2: Lady Morgan (Dramatic Voice)
    const verId2B = await this.saveVersion({
      bookId: bookId2,
      voiceActor: 'Lady Morgan',
    });

    const fileId2B_1 = await this.saveFile({
      versionId: verId2B,
      fileName: 'The Invisible Man - Part 01_Morgan.mp3',
      filePath: 'DEMO_NARRATOR_MORGAN_PART1',
      partNumber: 1,
      orderIndex: 0,
      durationMs: 270000,
    });

    await this.saveChaptersBulk(fileId2B_1, [
      { title: 'Chapter I: Arrival at the Coach and Horses', startTimeMs: 0, endTimeMs: 270000 },
    ]);
  }
}

export const db = new AudiobookDatabase();
