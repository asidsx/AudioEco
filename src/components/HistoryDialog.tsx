/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { History, X, Clock, Play } from 'lucide-react';
import { db } from '../lib/db';
import { HistoryEntry, BookFile, BookVersion, Language } from '../types';
import { getTranslations } from '../translations';

interface HistoryDialogProps {
  bookId: number;
  files: BookFile[];
  versions: BookVersion[];
  chapters: any[];
  onSelectPosition: (globalMs: number) => void;
  onClose: () => void;
  language: Language;
}

export default function HistoryDialog({
  bookId,
  files,
  versions,
  chapters,
  onSelectPosition,
  onClose,
  language,
}: HistoryDialogProps) {
  const t = getTranslations(language);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const data = await db.getHistory(bookId);
        setHistory(data);
      } catch (err) {
        console.error('History fetch failed', err);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, [bookId]);

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

  const getActorName = (versionId: number) => {
    return versions.find((v) => v.id === versionId)?.voiceActor || 'Narrator';
  };

  const getFileName = (fileId: number) => {
    return files.find((f) => f.id === fileId)?.fileName || `Part File ${fileId}`;
  };

  // Human string formatting of raw dates
  const formatDate = (ts: number) => {
    const date = new Date(ts * 1000);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Identify chapter active at this historical milestone
  const getChapterTitleForPosition = (fileId: number, positionMs: number) => {
    const fileIndex = files.findIndex((f) => f.id === fileId);
    if (fileIndex === -1) return '';

    // Calculate absolute global ms for this milestone
    let fileStartGlobal = 0;
    let accumulated = 0;
    for (let i = 0; i < files.length; i++) {
      if (files[i].id === fileId) {
        fileStartGlobal = accumulated;
        break;
      }
      accumulated += files[i].durationMs;
    }

    const milestoneGlobalMs = fileStartGlobal + positionMs;

    let matchingChapter = '';
    for (let i = chapters.length - 1; i >= 0; i--) {
      const ch = chapters[i];
      if (ch.globalStartMs !== undefined && milestoneGlobalMs >= ch.globalStartMs) {
        matchingChapter = ch.title;
        break;
      }
    }
    return matchingChapter ? ` — ${matchingChapter}` : '';
  };

  const handleEntryClick = (entry: HistoryEntry) => {
    // Find absolute position
    let fileStartGlobal = 0;
    const fileIndex = files.findIndex((f) => f.id === entry.fileId);
    if (fileIndex !== -1) {
      let accumulated = 0;
      for (let i = 0; i < fileIndex; i++) {
        accumulated += files[i].durationMs;
      }
      fileStartGlobal = accumulated;
    }

    const calculatedGlobalMs = fileStartGlobal + entry.positionMs;
    onSelectPosition(calculatedGlobalMs);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div 
        id="history-card"
        className="flex h-full max-h-[480px] w-full max-w-md flex-col rounded-lg bg-slate-900 text-slate-300 shadow-2xl border border-slate-800"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <History className="h-4.5 w-4.5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white tracking-tight uppercase">{t.historyTitle}</h3>
          </div>
          <button 
            id="history-close-btn"
            onClick={onClose} 
            className="rounded p-1 text-slate-500 hover:bg-slate-950 hover:text-white transition-colors"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {loading ? (
            <div className="flex h-full items-center justify-center text-slate-500 font-mono text-[11px]">
              <span className="animate-pulse">{language === 'ru' ? 'Получение контрольных точек прогресса...' : 'Retrieving pipeline checkpoints...'}</span>
            </div>
          ) : history.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-slate-600 py-10 bg-slate-950/20 rounded">
              <Clock className="h-8 w-8 text-slate-700 mb-2 animate-pulse" />
              <p className="text-xs font-semibold">{language === 'ru' ? 'Контрольные точки не найдены' : 'No checkpoints logged'}</p>
              <p className="text-[10px] max-w-xs mt-1">
                {language === 'ru' ? 'Прогресс автоматически сохраняется при паузе или каждые 3 минуты.' : 'Progress checkpoints are auto-saved during pause or every 3 minutes.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((entry, index) => {
                const chapterLabel = getChapterTitleForPosition(entry.fileId, entry.positionMs);
                return (
                  <button
                    id={`history-item-${index}`}
                    key={entry.id || index}
                    onClick={() => handleEntryClick(entry)}
                    className="group w-full flex items-start justify-between gap-3 rounded bg-slate-950 p-3 text-left border border-slate-850 hover:border-slate-750 hover:bg-slate-900 hover:shadow-md transition-all duration-150"
                  >
                    <div className="space-y-1 overflow-hidden">
                      <div className="flex items-center gap-1.5 text-[9px] text-slate-500 font-mono">
                        <span>{formatDate(entry.timestamp)}</span>
                        <span>•</span>
                        <span className="text-indigo-400 font-bold truncate">{getActorName(entry.versionId)}</span>
                      </div>
                      <p className="font-semibold text-xs text-slate-200 truncate leading-tight">
                        {getFileName(entry.fileId)}
                      </p>
                      {chapterLabel && (
                        <p className="text-[10px] text-emerald-400/90 font-medium font-mono truncate">
                          {chapterLabel}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end shrink-0 gap-1.5">
                      <span className="text-[9px] font-mono font-bold rounded bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 text-indigo-400">
                        {formatTime(entry.positionMs)}
                      </span>
                      <span className="text-[9px] text-slate-500 flex items-center gap-0.5 group-hover:text-indigo-400 transition-colors font-mono uppercase tracking-tighter">
                        <Play className="h-2 w-2 fill-current" /> {language === 'ru' ? 'Перейти' : 'Teleport'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 px-5 py-3 bg-slate-950/40 text-center text-[10px] text-slate-500 rounded-b">
          {language === 'ru' ? 'Нажмите на точку, чтобы восстановить состояние воспроизведения' : 'Click checkpoint to teleport and restore streaming state'}
        </div>
      </div>
    </div>
  );
}
