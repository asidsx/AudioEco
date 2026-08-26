/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import LibraryView from './components/LibraryView';
import PlayerView from './components/PlayerView';
import { db } from './lib/db';
import { getSystemLanguage } from './translations';

export default function App() {
  const [currentView, setCurrentView] = useState<'library' | 'player'>('library');
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [selectedBookTitle, setSelectedBookTitle] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);
  const [language, setLanguage] = useState<'en' | 'ru'>(getSystemLanguage());

  // Initialize IndexedDB and pre-load classic demo books on startup
  useEffect(() => {
    async function initDB() {
      try {
        await db.init();
        await db.loadDemoBooksIfEmpty();
        setRefreshCount((prev) => prev + 1); // Trigger library reload
      } catch (err) {
        console.error('[App] Failed to initialize DB:', err);
      }
    }
    initDB();
  }, []);

  const handleBookSelected = (id: number, title: string) => {
    setSelectedBookId(id);
    setSelectedBookTitle(title);
    setCurrentView('player');
  };

  const handleGoBack = () => {
    setSelectedBookId(null);
    setSelectedBookTitle('');
    setCurrentView('library');
    setRefreshCount((prev) => prev + 1); // Refresh books state (progress, etc.)
  };

  return (
    <div className="mx-auto my-0 h-screen max-w-md bg-slate-950 flex flex-col relative select-none font-sans overflow-hidden shadow-2xl border-x border-slate-900">
      {currentView === 'library' ? (
        <LibraryView 
          onSelectBook={handleBookSelected} 
          onRefreshTriggered={refreshCount} 
          language={language}
          onChangeLanguage={setLanguage}
        />
      ) : (
        selectedBookId !== null && (
          <PlayerView
            bookId={selectedBookId}
            bookTitle={selectedBookTitle}
            onGoBack={handleGoBack}
            language={language}
            onChangeLanguage={setLanguage}
          />
        )
      )}
    </div>
  );
}
