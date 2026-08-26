/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Undo2,
  Redo2,
  Volume2,
  Clock,
  BookOpen,
  History as HistoryIcon,
  Moon,
  ArrowUp,
  ArrowDown,
  VolumeX,
  Languages,
} from 'lucide-react';
import { db } from '../lib/db';
import { audioEngine } from '../lib/audioEngine';
import { Book, BookVersion, BookFile, BookChapter, Language } from '../types';
import { getTranslations } from '../translations';
import ChaptersDialog from './ChaptersDialog';
import HistoryDialog from './HistoryDialog';

interface PlayerViewProps {
  bookId: number;
  bookTitle: string;
  onGoBack: () => void;
  language: Language;
  onChangeLanguage: (lang: Language) => void;
}

export default function PlayerView({ bookId, bookTitle, onGoBack, language, onChangeLanguage }: PlayerViewProps) {
  const t = getTranslations(language);
  // Database State info
  const [book, setBook] = useState<Book | null>(null);
  const [versions, setVersions] = useState<BookVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<number>(-1);
  const [files, setFiles] = useState<BookFile[]>([]);
  const [chapters, setChapters] = useState<BookChapter[]>([]);

  // Real-time Playback states matching audioEngine subscriptions
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [currentFileIndex, setCurrentFileIndex] = useState(-1);
  const [currentChapterTitle, setCurrentChapterTitle] = useState('');

  // Local interaction handles
  const [sliderPressed, setSliderPressed] = useState(false);
  const [localSliderVal, setLocalSliderVal] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [showMuted, setShowMuted] = useState(false);

  // Undo / Redo Seek leap tracking
  const [undoStack, setUndoStack] = useState<number[]>([]);
  const [redoStack, setRedoStack] = useState<number[]>([]);

  // Dialog Launches
  const [showChapters, setShowChapters] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Renaming book metadata states
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleVal, setEditTitleVal] = useState('');
  const [editAuthorVal, setEditAuthorVal] = useState('');

  // Sleep Timer additions
  const [sleepTimerId, setSleepTimerId] = useState<any>(null);
  const [sleepMinutes, setSleepMinutes] = useState<number>(0); // 0 = disabled, else 15, 30, 45, 60
  const [sleepSecondsLeft, setSleepSecondsLeft] = useState<number>(0);

  // Refs for volume state
  const prevVolumeRef = useRef<number>(1.0);
  const isDraggingRef = useRef<boolean>(false);
  const localSliderValRef = useRef<number>(0);

  // Synchronize dynamic parameters of database and versions
  useEffect(() => {
    async function loadBookData() {
      try {
        const fetchedBook = await db.getBookById(bookId);
        if (fetchedBook) {
          setBook(fetchedBook);
          setEditTitleVal(fetchedBook.folderName);
          setEditAuthorVal(fetchedBook.author || '');
        }

        const fetchedVersions = await db.getVersions(bookId);
        setVersions(fetchedVersions);

        if (fetchedVersions.length > 0) {
          // Detect saved playback state
          const savedState = await db.getPlaybackState(bookId);
          let startVerId = fetchedVersions[0].id;
          let startFileId = undefined;
          let startPos = 0;

          if (savedState) {
            startVerId = savedState.activeVersionId;
            startFileId = savedState.currentFileId;
            startPos = savedState.positionMs;
          }

          setActiveVersionId(startVerId);
          setPlaybackRate(audioEngine.getPlaybackRate());
          setVolume(audioEngine.getVolume());

          // Load version into audioEngine
          await audioEngine.loadVersion(bookId, startVerId, startFileId, startPos);
          setChapters(audioEngine.chapters);
          setFiles(audioEngine.files);
        }
      } catch (err) {
        console.error('[PLAYER] Load book info failed:', err);
      }
    }
    loadBookData();
  }, [bookId]);

  // Handle active versions change
  const handleVersionChange = async (verId: number) => {
    if (verId === activeVersionId) return;
    audioEngine.pause();
    setActiveVersionId(verId);
    
    // Load fresh version files
    await audioEngine.loadVersion(bookId, verId);
    setFiles(audioEngine.files);
    setChapters(audioEngine.chapters);
    
    // Reset Undo/Redo tracking
    setUndoStack([]);
    setRedoStack([]);
  };

  // Subscribe to real-time events on AudioEngine to bypass React re-renders loops
  useEffect(() => {
    const unsubState = audioEngine.subscribePlaybackState((state) => setIsPlaying(state));
    const unsubPos = audioEngine.subscribePosition((pos) => {
      setPositionMs(pos);
      if (!isDraggingRef.current) {
        setLocalSliderVal(pos);
        localSliderValRef.current = pos;
      }
    });
    const unsubDur = audioEngine.subscribeDuration((dur) => setDurationMs(dur));
    const unsubFile = audioEngine.subscribeFileChanged((idx) => setCurrentFileIndex(idx));
    const unsubChap = audioEngine.subscribeChapter((chap) => setCurrentChapterTitle(chap));

    return () => {
      unsubState();
      unsubPos();
      unsubDur();
      unsubFile();
      unsubChap();
    };
  }, []);



  // Sleep Timer countdown tickers
  useEffect(() => {
    if (sleepMinutes <= 0) {
      if (sleepTimerId) {
        clearInterval(sleepTimerId);
        setSleepTimerId(null);
      }
      setSleepSecondsLeft(0);
      return;
    }

    const secondsLimit = sleepMinutes * 60;
    setSleepSecondsLeft(secondsLimit);

    if (sleepTimerId) clearInterval(sleepTimerId);

    const intId = setInterval(() => {
      setSleepSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intId);
          setSleepMinutes(0);
          audioEngine.pause();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    setSleepTimerId(intId);

    return () => {
      if (intId) clearInterval(intId);
    };
  }, [sleepMinutes]);

  const handleApplySleepTimer = (mins: number) => {
    setSleepMinutes(mins);
  };

  // Clock formatter helper
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

  const formatSleepTimeLeft = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  // --- Undo & Redo History management ---
  const pushUndo = (pos: number) => {
    setUndoStack((prev) => [...prev, pos]);
    setRedoStack([]); // Clear redo
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const activePos = audioEngine.getGlobalPosition();
    const prevPos = undoStack[undoStack.length - 1];

    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, activePos]);

    audioEngine.setGlobalPosition(prevPos);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const activePos = audioEngine.getGlobalPosition();
    const nextPos = redoStack[redoStack.length - 1];

    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, activePos]);

    audioEngine.setGlobalPosition(nextPos);
  };

  // --- Seek actions ---
  const handleSeekRelative = (deltaMs: number) => {
    pushUndo(audioEngine.getGlobalPosition());
    audioEngine.seekRelative(deltaMs);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setLocalSliderVal(value);
    localSliderValRef.current = value;
    isDraggingRef.current = true;
  };

  const handleSliderTouchStart = () => {
    isDraggingRef.current = true;
    setSliderPressed(true);
    pushUndo(audioEngine.getGlobalPosition());
  };

  const handleSliderTouchEnd = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      audioEngine.setGlobalPosition(localSliderValRef.current);
    }
    setSliderPressed(false);
  };

  // --- Control dials and parameters ---
  const handlePlayPause = () => {
    if (isPlaying) {
      audioEngine.pause();
    } else {
      audioEngine.play();
    }
  };

  const handleModifySpeed = (delta: number) => {
    const rate = parseFloat((playbackRate + delta).toFixed(1));
    const nextRate = Math.max(0.5, Math.min(3.0, rate));
    setPlaybackRate(nextRate);
    audioEngine.setPlaybackRate(nextRate);
  };

  const handleModifyVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    audioEngine.setVolume(val);
    if (val > 0) {
      setShowMuted(false);
    }
  };

  const handleToggleMute = () => {
    if (showMuted) {
      const restored = prevVolumeRef.current || 1.0;
      setVolume(restored);
      audioEngine.setVolume(restored);
      setShowMuted(false);
    } else {
      prevVolumeRef.current = volume;
      setVolume(0);
      audioEngine.setVolume(0);
      setShowMuted(true);
    }
  };

  const handleSaveBookMeta = async () => {
    if (!book || !editTitleVal.trim()) return;
    try {
      const updatedBook = {
        ...book,
        folderName: editTitleVal.trim(),
        author: editAuthorVal.trim(),
      };
      await db.saveBook(updatedBook);
      setBook(updatedBook);
      setIsEditingTitle(false);
    } catch (err) {
      console.error('[PLAYER] Failed to rename book:', err);
    }
  };

  const handleAddNewFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0 || activeVersionId === -1) return;

    try {
      const currentFilesCount = files.length;
      
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        
        // Measure duration in browser
        const durationMs = await new Promise<number>((resolve) => {
          const audio = new Audio();
          const objectUrl = URL.createObjectURL(file);
          audio.src = objectUrl;
          audio.preload = 'metadata';
          audio.addEventListener('loadedmetadata', () => {
            resolve(Math.floor(audio.duration * 1000) || 120000);
            URL.revokeObjectURL(objectUrl);
          });
          audio.addEventListener('error', () => {
            resolve(120000); // 2 minute default if failure or timeout
            URL.revokeObjectURL(objectUrl);
          });
        });

        // Save in indexedDB
        const newFileIndex = currentFilesCount + i;
        await db.saveFile({
          versionId: activeVersionId,
          fileName: file.name,
          filePath: '',
          partNumber: newFileIndex + 1,
          orderIndex: newFileIndex,
          durationMs,
          fileObject: file,
        });
      }

      // Clear input selection
      e.target.value = '';

      // Re-load the database version inside audioEngine to update structures
      const activeFileId = files[currentFileIndex]?.id;
      const activeLocalPos = positionMs - (audioEngine.fileStartOffsets[currentFileIndex] || 0);
      
      await audioEngine.loadVersion(bookId, activeVersionId, activeFileId, activeLocalPos);
      setFiles(audioEngine.files);
      setChapters(audioEngine.chapters);
    } catch (err) {
      console.error('[PLAYER] Failed to add new files:', err);
    }
  };

  // --- Playlist Sequence sorting, moves & double tap tracks triggers ---
  const handleMoveFileOrder = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === files.length - 1) return;

    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const reordered = [...files];
    const temp = reordered[index];
    reordered[index] = reordered[targetIdx];
    reordered[targetIdx] = temp;

    // Map new orderedIndex into database list
    const mapped = reordered.map((f, i) => ({ id: f.id, orderIndex: i }));
    await db.updateFileOrder(mapped);

    // Refresh Files list in memory
    const activeFileId = files[currentFileIndex]?.id;
    const activeLocalPos = positionMs - (audioEngine.fileStartOffsets[currentFileIndex] || 0);

    // Reload files list in PlayerEngine offsets
    await audioEngine.loadVersion(bookId, activeVersionId, activeFileId, activeLocalPos);
    setFiles(audioEngine.files);
  };

  const handlePlaylistPartClick = (index: number) => {
    if (index === currentFileIndex) return;
    pushUndo(audioEngine.getGlobalPosition());
    
    // Jump to the absolute beginning offset of selected track index
    const startOffset = audioEngine.fileStartOffsets[index] || 0;
    audioEngine.setGlobalPosition(startOffset);
    audioEngine.play();
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-300">
      {/* Top Banner Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-slate-900 border-b border-slate-800 px-4 py-2.5 shadow-md shrink-0">
        <button
          id="player-back-btn"
          onClick={() => {
            audioEngine.pause();
            onGoBack();
          }}
          className="flex items-center gap-1.5 text-[10px] uppercase font-mono tracking-wider text-slate-400 hover:text-white bg-slate-950 border border-slate-850 font-bold px-2.5 py-1.5 rounded transition-all cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t.backBtn}
        </button>

        <div className="flex flex-col items-center flex-1 mx-3 min-w-0">
          <h2 id="player-title" className="text-xs font-bold text-slate-200 truncate max-w-[155px]">
            {book?.folderName || bookTitle}
          </h2>
        </div>

        {/* Narrator Multi-Version Switcher */}
        {versions.length > 0 && (
          <div className="relative inline-block shrink-0">
            <select
              id="voice-select-box"
              value={activeVersionId}
              onChange={(e) => handleVersionChange(parseInt(e.target.value, 10))}
              className="appearance-none bg-slate-950 border border-slate-850 hover:border-slate-700 text-[10px] font-bold py-1.5 pl-2.5 pr-7 rounded outline-none focus:ring-1 focus:ring-indigo-500 text-slate-300 cursor-pointer"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  🎙️ {v.voiceActor.split(' ')[0]}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-2.5 h-3 w-3 text-slate-500 pointer-events-none" />
          </div>
        )}
      </header>

      {/* Main Container Scrollable */}
      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4 custom-scrollbar pb-8">
        {/* Artwork Area Card */}
        <div id="artwork-block" className="flex items-center gap-3.5 bg-slate-900/65 p-3.5 rounded-lg border border-slate-850 relative">
          <div className={`relative h-22 w-18 rounded overflow-hidden bg-slate-950 shadow-md border border-slate-800 shrink-0 transition-all ${isPlaying ? 'ring-1 ring-indigo-500/50 scale-[1.02]' : ''}`}>
            <img
              src={book?.coverUrl || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=300'}
              alt={book?.folderName || bookTitle}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
            {isPlaying && (
              <div className="absolute inset-0 bg-slate-950/40 flex items-center justify-center">
                <div className="flex items-end gap-0.5 h-4">
                  <span className="w-0.5 h-3 bg-indigo-400 rounded-sm animate-bounce delay-100" />
                  <span className="w-0.5 h-4 bg-emerald-400 rounded-sm animate-bounce delay-300" />
                  <span className="w-0.5 h-3 bg-indigo-400 rounded-sm animate-bounce delay-200" />
                </div>
              </div>
            )}
          </div>
          
          {isEditingTitle ? (
            <div className="flex-1 min-w-0 space-y-1.5 pr-1">
              <input
                id="edit-book-title-input"
                type="text"
                value={editTitleVal}
                onChange={(e) => setEditTitleVal(e.target.value)}
                className="w-full bg-slate-950 text-xs font-bold text-slate-100 px-2 py-1 rounded border border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder={t.editTitle}
                autoFocus
              />
              <input
                id="edit-book-author-input"
                type="text"
                value={editAuthorVal}
                onChange={(e) => setEditAuthorVal(e.target.value)}
                className="w-full bg-slate-950 text-[10px] text-slate-300 px-2 py-1 rounded border border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800"
                placeholder={t.editAuthor}
              />
              <div className="flex gap-1.5 mt-1">
                <button
                  id="save-book-meta-btn"
                  onClick={handleSaveBookMeta}
                  className="px-2 py-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded hover:bg-emerald-500/20 transition-all cursor-pointer"
                >
                  {t.saveBtn}
                </button>
                <button
                  id="cancel-book-meta-btn"
                  onClick={() => {
                    setIsEditingTitle(false);
                    if (book) {
                      setEditTitleVal(book.folderName);
                      setEditAuthorVal(book.author || '');
                    }
                  }}
                  className="px-2 py-1 text-[9px] font-bold text-slate-400 bg-slate-500/10 border border-slate-500/10 rounded hover:bg-slate-500/20 transition-all cursor-pointer"
                >
                  {t.cancelBtn}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-w-0 relative group">
              <div className="flex gap-1.5 items-center justify-between pb-1">
                <div className="flex gap-1.5 items-center px-1.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded">
                  <span className="text-[8px] font-extrabold text-indigo-400 uppercase tracking-widest font-mono">
                    {isPlaying ? 'ENGINE_ACTIVE' : 'ENGINE_PAUSED'}
                  </span>
                </div>
                <button
                  id="edit-book-title-btn"
                  onClick={() => setIsEditingTitle(true)}
                  className="text-[9px] px-1.5 py-0.5 rounded border border-slate-800 text-slate-400 bg-slate-950 hover:text-white hover:bg-slate-900 transition-colors cursor-pointer flex items-center gap-1 font-mono uppercase shrink-0"
                >
                  ✏️ {t.editDetails}
                </button>
              </div>
              <h3 id="book-title-display" className="text-xs font-bold text-slate-100 leading-snug">
                {book?.folderName || bookTitle}
              </h3>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5 truncate">
                {book?.author || 'H.G. Wells'}
              </p>
              {currentChapterTitle && (
                <div className="text-[10px] text-emerald-400 font-semibold font-mono truncate mt-1">
                  {currentChapterTitle}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Progress Timeline Absolute Control slider */}
        <div id="progress-timeline" className="space-y-1 bg-slate-900/40 p-3 rounded-lg border border-slate-900">
          <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-500 px-0.5">
            <span className="text-indigo-400">{formatTime(localSliderVal)}</span>
            <span>{formatTime(durationMs)}</span>
          </div>

          <div className="relative group">
            <input
              id="global-slider"
              type="range"
              min={0}
              max={durationMs}
              value={localSliderVal}
              onChange={handleSliderChange}
              onMouseDown={handleSliderTouchStart}
              onMouseUp={handleSliderTouchEnd}
              onTouchStart={handleSliderTouchStart}
              onTouchEnd={handleSliderTouchEnd}
              onLostPointerCapture={handleSliderTouchEnd}
              style={{
                background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${(localSliderVal / (durationMs || 1)) * 100}%, #1e293b ${(localSliderVal / (durationMs || 1)) * 100}%, #1e293b 100%)`,
              }}
              className="slider w-full h-1 rounded appearance-none cursor-pointer outline-none bg-slate-800 accent-indigo-500"
            />
          </div>
        </div>

        {/* Media Control Button Rack */}
        <div id="media-buttons" className="flex flex-col gap-3 bg-slate-900/60 p-3 rounded-lg border border-slate-850">
          <div className="flex items-center justify-center gap-4">
            {/* Undo leap */}
            <button
              id="undo-btn"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className="text-slate-500 hover:text-slate-200 disabled:opacity-25 hover:bg-slate-950 p-2 rounded transition-colors cursor-pointer"
              title={t.undoTooltip}
            >
              <Undo2 className="h-4.5 w-4.5" />
            </button>

            {/* Skip Back 10s */}
            <button
              id="skip-back-btn"
              onClick={() => handleSeekRelative(-10000)}
              className="text-slate-400 hover:text-slate-200 hover:bg-slate-950 p-2 rounded transition-colors cursor-pointer"
              title="-10s"
            >
              <RotateCcw className="h-4.5 w-4.5" />
            </button>

            {/* Play/Pause float */}
            <button
              id="play-pause-btn"
              onClick={handlePlayPause}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer border border-indigo-500/20"
            >
              {isPlaying ? <Pause className="h-5 w-5 fill-white" /> : <Play className="h-5 w-5 fill-white translate-x-0.5" />}
            </button>

            {/* Skip Fwd 10s */}
            <button
              id="skip-fwd-btn"
              onClick={() => handleSeekRelative(10000)}
              className="text-slate-400 hover:text-slate-200 hover:bg-slate-950 p-2 rounded transition-colors cursor-pointer"
              title="+10s"
            >
              <RotateCw className="h-4.5 w-4.5" />
            </button>

            {/* Redo leap */}
            <button
              id="redo-btn"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className="text-slate-500 hover:text-slate-200 disabled:opacity-25 hover:bg-slate-950 p-2 rounded transition-colors cursor-pointer"
              title={t.redoTooltip}
            >
              <Redo2 className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* Chapters of active list, Sleep Timer, and Milestones Launcher Bar */}
          <div className="grid grid-cols-4 gap-1.5 pt-1.5 border-t border-slate-800/50">
            <button
              id="launcher-chapters"
              onClick={() => setShowChapters(true)}
              className="flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-white bg-slate-950 border border-slate-850 rounded py-2 px-0.5 transition-colors cursor-pointer"
            >
              <BookOpen className="h-3.5 w-3.5 text-indigo-400" />
              <span className="text-[9px] font-bold uppercase tracking-wider font-mono">{t.chapters}</span>
            </button>

            <button
              id="launcher-history"
              onClick={() => setShowHistory(true)}
              className="flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-white bg-slate-950 border border-slate-850 rounded py-2 px-0.5 transition-colors cursor-pointer"
            >
              <HistoryIcon className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[9px] font-bold uppercase tracking-wider font-mono">{t.history}</span>
            </button>

            {/* Speed adjustments */}
            <div className="flex flex-col items-center justify-center bg-slate-950 border border-slate-850 rounded py-1 px-0.5">
              <span className="text-[8px] text-slate-500 uppercase font-mono tracking-wider font-extrabold">{t.speed}</span>
              <div className="flex items-center gap-1 text-slate-300 mt-0.5">
                <button
                  id="speed-minus"
                  onClick={() => handleModifySpeed(-0.1)}
                  className="px-1 hover:text-indigo-400 text-[10px] font-bold font-mono transition-colors cursor-pointer"
                >
                  -
                </button>
                <span className="text-[9px] font-extrabold font-mono text-indigo-400 leading-none shrink-0">
                  {playbackRate.toFixed(1)}x
                </span>
                <button
                  id="speed-plus"
                  onClick={() => handleModifySpeed(0.1)}
                  className="px-1 hover:text-indigo-400 text-[10px] font-bold font-mono transition-colors cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            {/* Sleep timer dropdown options */}
            <div className="relative group flex flex-col items-center justify-center bg-slate-950 border border-slate-850 rounded py-1 px-0.5 select-none md:hover:bg-slate-905 cursor-pointer">
              <Moon className={`h-3.5 w-3.5 ${sleepMinutes > 0 ? 'text-indigo-400 animate-pulse' : 'text-slate-500'}`} />
              <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider font-mono mt-0.5 leading-none">
                {sleepMinutes > 0 ? formatSleepTimeLeft(sleepSecondsLeft) : t.sleepTimer}
              </span>

              {/* Dynamic Sleep Options Panel floating */}
              <div className="absolute bottom-11 z-10 hidden group-hover:flex flex-col bg-slate-900 border border-slate-800 rounded shadow-xl py-1 px-1 w-24 text-center text-[9px] animate-fade-in-up">
                <p className="text-[8px] text-slate-500 border-b border-slate-800 pb-0.5 mb-1 font-bold uppercase tracking-wider">{t.sleepTimer}</p>
                <button onClick={() => handleApplySleepTimer(0)} className={`py-1 hover:bg-slate-950 rounded px-1 cursor-pointer font-mono ${sleepMinutes === 0 ? 'text-indigo-400 font-bold' : ''}`}>{t.off}</button>
                <button onClick={() => handleApplySleepTimer(15)} className={`py-1 hover:bg-slate-950 rounded px-1 cursor-pointer font-mono ${sleepMinutes === 15 ? 'text-indigo-400 font-bold' : ''}`}>15{t.minutesShort}</button>
                <button onClick={() => handleApplySleepTimer(30)} className={`py-1 hover:bg-slate-950 rounded px-1 cursor-pointer font-mono ${sleepMinutes === 30 ? 'text-indigo-400 font-bold' : ''}`}>30{t.minutesShort}</button>
                <button onClick={() => handleApplySleepTimer(45)} className={`py-1 hover:bg-slate-950 rounded px-1 cursor-pointer font-mono ${sleepMinutes === 45 ? 'text-indigo-400 font-bold' : ''}`}>45{t.minutesShort}</button>
                <button onClick={() => handleApplySleepTimer(60)} className={`py-1 hover:bg-slate-950 rounded px-1 cursor-pointer font-mono ${sleepMinutes === 60 ? 'text-indigo-400 font-bold' : ''}`}>60{t.minutesShort}</button>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Volume levels */}
        <div id="volume-fader" className="flex items-center gap-3 bg-slate-900/40 px-3.5 py-2 rounded border border-slate-900">
          <button id="volume-toggle-icon" onClick={handleToggleMute} className="text-slate-500 hover:text-white transition-colors cursor-pointer">
            {showMuted || volume === 0 ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <input
            id="volume-slider"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={handleModifyVolume}
            style={{
              background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${volume * 100}%, #1e293b ${volume * 100}%, #1e293b 100%)`,
            }}
            className="slider w-full h-1 rounded appearance-none cursor-pointer outline-none bg-slate-800 accent-indigo-500"
          />
        </div>

        {/* Reorderable Parts Playlist sequence */}
        <section id="playlist-files" className="space-y-2 pt-1">
          <div className="flex items-center justify-between pl-0.5 pr-1">
            <h4 className="text-[9px] font-extrabold uppercase tracking-widest text-slate-500 flex items-center gap-1">
              <span className="inline-block w-1 h-1 bg-indigo-500 rounded-full"></span>
              {t.partsRegistry} ({files.length})
            </h4>
            <label className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider font-mono hover:text-indigo-300 cursor-pointer flex items-center gap-1.5 transition-colors px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded">
              <span>➕ {t.addFiles}</span>
              <input
                id="add-audio-file-input"
                type="file"
                accept="audio/*"
                multiple
                className="hidden"
                onChange={handleAddNewFiles}
              />
            </label>
          </div>

          <div className="space-y-1.5 max-h-[170px] overflow-y-auto pr-0.5 select-none custom-scrollbar">
            {files.map((item, index) => {
              const isCurrent = index === currentFileIndex;
              return (
                <div
                  id={`playlist-item-${index}`}
                  key={item.id}
                  onClick={() => handlePlaylistPartClick(index)}
                  className={`flex items-center justify-between gap-2.5 px-3 py-2 rounded border transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400'
                      : 'bg-slate-900/40 border-slate-900/80 hover:border-slate-800 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="min-w-0 flex-1 flex items-center gap-2">
                    <span className={`text-[9px] font-mono leading-none flex h-4 w-4 items-center justify-center rounded ${
                      isCurrent ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-800 text-slate-500'
                    }`}>
                      {index + 1}
                    </span>
                    <p className="text-[11px] font-semibold truncate py-0.5 leading-none" title={item.fileName}>
                      {item.fileName}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                    <span className="text-[9px] font-mono text-slate-500">
                      {formatTime(item.durationMs)}
                    </span>

                    {/* Move Sequence buttons */}
                    <div className="flex items-center gap-0.5 border-l border-slate-800/80 pl-1.5">
                      <button
                        id={`move-up-${index}`}
                        disabled={index === 0}
                        onClick={() => handleMoveFileOrder(index, 'up')}
                        className="rounded hover:bg-slate-950 p-1 text-slate-500 hover:text-slate-300 disabled:opacity-20 cursor-pointer transition-colors"
                        title="Move sequence order up"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        id={`move-down-${index}`}
                        disabled={index === files.length - 1}
                        onClick={() => handleMoveFileOrder(index, 'down')}
                        className="rounded hover:bg-slate-950 p-1 text-slate-500 hover:text-slate-300 disabled:opacity-20 cursor-pointer transition-colors"
                        title="Move sequence order down"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Chapters Overlay Modal */}
      {showChapters && (
        <ChaptersDialog
          chapters={chapters}
          currentChapterTitle={currentChapterTitle}
          onSelectChapter={audioEngine.setGlobalPosition.bind(audioEngine)}
          onClose={() => setShowChapters(false)}
          language={language}
        />
      )}

      {/* History Overlay Modal */}
      {showHistory && (
        <HistoryDialog
          bookId={bookId}
          files={files}
          versions={versions}
          chapters={chapters}
          onSelectPosition={audioEngine.setGlobalPosition.bind(audioEngine)}
          onClose={() => setShowHistory(false)}
          language={language}
        />
      )}
    </div>
  );
}
