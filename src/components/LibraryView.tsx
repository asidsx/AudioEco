/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { BookOpen, RefreshCw, Upload, FileAudio, FolderPlus, Compass, Trash2, Languages } from 'lucide-react';
import { db } from '../lib/db';
import { scanUploadedFiles } from '../lib/scanner';
import { Book } from '../types';
import { translations } from '../translations';

interface LibraryViewProps {
  onSelectBook: (bookId: number, name: string) => void;
  onRefreshTriggered: number;
  language: 'en' | 'ru';
  onChangeLanguage: (lang: 'en' | 'ru') => void;
}

export default function LibraryView({ onSelectBook, onRefreshTriggered, language, onChangeLanguage }: LibraryViewProps) {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const t = translations[language];

  const fetchBooks = async () => {
    try {
      const data = await db.getBooks();
      setBooks(data);
    } catch (err) {
      console.error('[Library] Failed to fetch books:', err);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, [onRefreshTriggered]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleManualScan = async () => {
    setLoading(true);
    showToast(t.scanningLocal, 'success');
    try {
      // Simulate disk load and populate mock files
      await db.loadDemoBooksIfEmpty();
      await fetchBooks();
      showToast(t.scanComplete, 'success');
    } catch (err: any) {
      showToast(err.message || (language === 'ru' ? 'Ошибка сканирования' : 'Scan failed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setLoading(true);
    try {
      const parsedTitles = await scanUploadedFiles(files);
      await fetchBooks();
      showToast(`${t.importedBook}${parsedTitles || (language === 'ru' ? 'Структура файлов' : 'Files structure')}`, 'success');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || t.fileImportFailed, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFileUpload(e.dataTransfer.files);
    }
  };

  const handleDeleteBook = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (confirmDeleteId === id) {
      setConfirmDeleteId(null);
      try {
        await db.deleteBook(id);
        await fetchBooks();
        showToast(t.audiobookRemoved, 'success');
      } catch (err) {
        console.error('[Library] Failed to delete book:', err);
        showToast(t.deletionFailed, 'error');
      }
    } else {
      setConfirmDeleteId(id);
      // Auto-expire confirmation after 4 seconds
      setTimeout(() => {
        setConfirmDeleteId((prev) => (prev === id ? null : prev));
      }, 4000);
    }
  };

  const handleResetDatabase = async () => {
    if (confirmReset) {
      setConfirmReset(false);
      try {
        await db.clearDatabase();
        await db.loadDemoBooksIfEmpty();
        await fetchBooks();
        showToast(t.libraryReset, 'success');
      } catch (err) {
        console.error('[Library] Failed to reset database:', err);
        showToast(t.resetFailed, 'error');
      }
    } else {
      setConfirmReset(true);
      // Auto-expire Reset confirmation state after 4 seconds
      setTimeout(() => {
        setConfirmReset((prev) => (prev ? false : prev));
      }, 4000);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-300">
      {/* Header Bar */}
      <header className="sticky top-0 z-30 flex flex-col bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-5 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white font-bold text-sm">A</div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                AudioECO <span className="text-slate-500 font-normal text-[10px]">v2.4.0-android_port</span>
              </h1>
              <p className="text-[9px] text-slate-500 font-mono">{language === 'ru' ? 'Аудио-конвейер' : 'Audiobook Pipeline'}</p>
            </div>
          </div>
          
          <div className="flex gap-2 items-center">
            {/* Language manual switch */}
            <button
              onClick={() => onChangeLanguage(language === 'en' ? 'ru' : 'en')}
              className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-950 border border-slate-850 rounded hover:border-slate-700 text-[10px] font-bold text-indigo-400 font-mono cursor-pointer transition-colors"
              title={language === 'en' ? 'Переключить на русский' : 'Switch to English'}
            >
              <Languages className="h-3.5 w-3.5 text-slate-400" />
              <span>{language === 'en' ? 'EN' : 'RU'}</span>
            </button>

            <div className="flex gap-1.5 items-center px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider font-mono">{t.online}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-800/60">
          <div className="text-[10px] text-slate-400 font-mono">
            {t.dbEntries}: <span className="text-indigo-400 font-bold">{books.length}</span>
          </div>
          
          <button
            id="refresh-lib-btn"
            disabled={loading}
            onClick={handleManualScan}
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed cursor-pointer transition-colors border border-indigo-500/25"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            {loading ? t.scanning : t.syncDisk}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-5 py-5 space-y-6 custom-scrollbar">
        {/* Toast State */}
        {toast && (
          <div className={`fixed top-18 right-6 z-50 flex items-center justify-center rounded px-3 py-2 shadow-lg text-[10px] font-mono transition-all duration-300 border ${
            toast.type === 'success' 
              ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300' 
              : 'bg-rose-950/90 border-rose-500 text-rose-300'
          }`}>
            {toast.message}
          </div>
        )}

        {/* Drag & Drop Import Node */}
        <section 
          id="dropzone"
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`relative border border-dashed rounded-lg flex flex-col items-center justify-center p-6 text-center transition-all ${
            dragActive 
              ? 'border-indigo-500 bg-indigo-950/20' 
              : 'border-slate-800 bg-slate-900/30 hover:border-slate-700 hover:bg-slate-900/60'
          }`}
        >
          {/* File input selectors */}
          <input
            id="file-input"
            ref={fileInputRef}
            type="file"
            multiple
            accept="audio/*"
            onChange={(e) => handleFileUpload(e.target.files)}
            className="hidden"
          />
          <input
            id="folder-input"
            ref={folderInputRef}
            type="file"
            multiple
            webkitdirectory="true"
            directory="true"
            onChange={(e) => handleFileUpload(e.target.files)}
            className="hidden"
          />

          <Upload className={`h-7 w-7 mb-2 ${dragActive ? 'text-indigo-400 scale-105' : 'text-slate-500'} transition-transform`} />
          
          <h2 className="text-xs font-bold text-slate-300">{t.fileIngestionChannel}</h2>
          <p className="text-[10px] text-slate-500 max-w-sm mt-0.5 mb-3.5">
            {t.dragDropSub}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              id="upload-files-btn"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-[10px] font-bold bg-slate-950 border border-slate-850 hover:border-slate-700 hover:bg-slate-900 px-3 py-1.5 rounded transition-all cursor-pointer"
            >
              <FileAudio className="h-3 w-3 text-indigo-400" />
              {t.selectFiles}
            </button>
            <button
              id="upload-folder-btn"
              onClick={() => folderInputRef.current?.click()}
              className="flex items-center gap-1.5 text-[10px] font-bold bg-slate-950 border border-slate-850 hover:border-slate-700 hover:bg-slate-900 px-3 py-1.5 rounded transition-all cursor-pointer"
            >
              <FolderPlus className="h-3 w-3 text-amber-500" />
              {t.uploadFolder}
            </button>
          </div>
        </section>

        {/* Books List Grid */}
        <section id="books-grid" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
              {t.indexedLibraryCatalog}
            </h2>
            {books.length > 0 && (
              <button
                id="reset-db-btn"
                onClick={handleResetDatabase}
                className={`text-[10px] font-mono tracking-tighter px-2 py-0.5 rounded transition-all cursor-pointer uppercase border ${
                  confirmReset
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 font-bold'
                    : 'text-rose-400 hover:text-rose-300 hover:bg-rose-500/5 border-transparent'
                }`}
              >
                {confirmReset ? t.confirmResetQuestion : t.resetDatabase}
              </button>
            )}
          </div>

          {books.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-900/20 border border-slate-900 rounded-lg">
              <Compass className="h-10 w-10 text-slate-700 mb-2 animate-pulse" />
              <p className="text-xs font-semibold text-slate-400">{t.libraryDbEmpty}</p>
              <p className="text-[10px] text-slate-500 max-w-xs mt-1">
                {language === 'ru' ? (
                  <>Загрузите файлы аудиокниг или нажмите <strong>Синхр. диск</strong> для получения демо-книг!</>
                ) : (
                  <>Upload raw audiobook files or click <strong>Sync Disk</strong> to populate high-fidelity system samples!</>
                )}
              </p>
              <button
                id="empty-refresh-btn"
                onClick={handleManualScan}
                className="mt-4 text-[10px] uppercase tracking-wider font-bold bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-600/25 px-4 py-2 rounded transition-colors cursor-pointer"
              >
                {t.restoreDemoResources}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              {books.map((book) => {
                const isCustom = book.path.startsWith('/books/uploaded');
                return (
                  <div
                    id={`book-card-${book.id}`}
                    key={book.id}
                    onClick={() => onSelectBook(book.id, book.folderName)}
                    className="group relative flex items-center gap-3 rounded-lg bg-slate-900/60 p-2.5 border border-slate-800/80 hover:border-slate-750 hover:bg-slate-900 hover:shadow-md transition-all duration-150 cursor-pointer"
                  >
                    {/* Cover Art Image */}
                    <div className="relative h-14 w-11 shrink-0 overflow-hidden rounded bg-slate-950 border border-slate-800">
                      <img
                        src={book.coverUrl || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=200'}
                        alt={book.folderName}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover transition-transform group-hover:scale-105 duration-300"
                      />
                    </div>

                    {/* Book Metadata details */}
                    <div className="flex-1 min-w-0 pr-8">
                      <h3 className="font-bold text-xs text-slate-200 group-hover:text-white transition-colors truncate">
                        {book.folderName}
                      </h3>
                      <p className="text-[11px] text-slate-400 truncate">
                        {book.author || 'H.G. Wells'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[9px] font-mono font-bold tracking-tight px-1.5 py-0.5 rounded ${
                          isCustom 
                            ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' 
                            : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                        }`}>
                          {isCustom ? t.customStream : t.preloadDemo}
                        </span>
                      </div>
                    </div>

                    {/* Trash Delete Action */}
                    <button
                      id={`delete-btn-${book.id}`}
                      onClick={(e) => handleDeleteBook(e, book.id)}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 transition-all rounded flex items-center gap-1 ${
                        confirmDeleteId === book.id
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 px-2 py-1 text-[9px] font-bold uppercase tracking-tight'
                          : 'text-slate-500 hover:text-rose-400 p-1'
                      }`}
                      title={confirmDeleteId === book.id ? t.deleteBookConfirmTooltip : t.deleteBookTooltip}
                    >
                      {confirmDeleteId === book.id ? (
                        <>
                          <Trash2 className="h-3 w-3 animate-bounce" />
                          <span>{t.deleteBtn}</span>
                        </>
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
