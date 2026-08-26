/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { BookOpen, X, Play, Clock, Search } from 'lucide-react';
import { BookChapter, Language } from '../types';
import { getTranslations } from '../translations';

interface ChaptersDialogProps {
  chapters: BookChapter[];
  currentChapterTitle: string;
  onSelectChapter: (globalMs: number) => void;
  onClose: () => void;
  language: Language;
}

export default function ChaptersDialog({
  chapters,
  currentChapterTitle,
  onSelectChapter,
  onClose,
  language,
}: ChaptersDialogProps) {
  const t = getTranslations(language);
  const [searchTerm, setSearchTerm] = useState('');

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const m = Math.floor(seconds / 60) % 60;
    const h = Math.floor(seconds / 3600);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const filteredChapters = chapters.filter((ch) =>
    ch.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div 
        id="chapters-dialog-card"
        className="flex h-full max-h-[480px] w-full max-w-md flex-col rounded-lg bg-slate-900 text-slate-300 shadow-2xl border border-slate-800"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4.5 w-4.5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white tracking-tight uppercase">{t.chapters}</h3>
          </div>
          <button 
            id="chapters-close-btn"
            onClick={onClose} 
            className="rounded p-1 text-slate-500 hover:bg-slate-950 hover:text-white transition-colors"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-slate-800 px-4 py-2.5 bg-slate-950/30">
          <div className="relative flex items-center rounded bg-slate-950 border border-slate-850 focus-within:border-indigo-500/80 transition-colors">
            <Search className="absolute left-3 h-3.5 w-3.5 text-slate-500" />
            <input
              id="chapters-search"
              type="text"
              placeholder={t.filterChapters}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent py-1.5 pl-9 pr-4 text-[11px] text-slate-200 placeholder-slate-500 outline-none"
            />
            {searchTerm && (
              <button
                id="clear-search-btn"
                onClick={() => setSearchTerm('')}
                className="mr-2 text-[10px] text-slate-400 hover:text-white font-mono uppercase"
              >
                {language === 'ru' ? 'Очистить' : 'Clear'}
              </button>
            )}
          </div>
        </div>

        {/* Chapters Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {filteredChapters.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-slate-500 py-10">
              <p className="text-xs">{language === 'ru' ? `Нет совпадений для "${searchTerm}"` : `No records matching "${searchTerm}"`}</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredChapters.map((ch, index) => {
                const isCurrent = ch.title === currentChapterTitle;
                return (
                  <button
                    id={`chapter-item-${index}`}
                    key={ch.id || index}
                    onClick={() => {
                      if (ch.globalStartMs !== undefined) {
                        onSelectChapter(ch.globalStartMs);
                      }
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between rounded px-3 py-2.5 text-left border transition-all duration-150 ${
                      isCurrent
                        ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400'
                        : 'bg-slate-950 border-slate-850 hover:border-slate-750 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden pr-4">
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold ${
                        isCurrent ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-800 text-slate-500'
                      }`}>
                        {index + 1}
                      </span>
                      <p className="font-semibold text-xs truncate">
                        {ch.title}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Clock className="h-3 w-3 text-slate-500" />
                      <span className="text-[10px] font-mono text-slate-400">
                        {formatTime(ch.startTimeMs)}
                      </span>
                      {isCurrent && (
                        <Play className="h-2.5 w-2.5 fill-current ml-1 text-emerald-400 animate-pulse" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 px-5 py-3 bg-slate-950/40 text-center text-[10px] text-slate-500 rounded-b">
          {language === 'ru' ? `Всего подразделов: ${chapters.length} проиндексировано` : `Total Buffer Index: ${chapters.length} mapped subdivisions`}
        </div>
      </div>
    </div>
  );
}
