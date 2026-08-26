/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Book, BookVersion, BookFile, BookChapter, PlaybackState } from '../types';
import { db } from './db';

type AudioStateCallback = (isPlaying: boolean) => void;
type PositionCallback = (positionMs: number) => void;
type DurationCallback = (durationMs: number) => void;
type FileChangedCallback = (index: number) => void;
type ChapterCallback = (title: string) => void;

/**
 * Generates a pleasant voice-like speech wave audio blob (PCM WAV) for demo books.
 * This guarantees true native HTMLAudioElement background playback when minimized.
 */
function generateDemoAudioBlobUrl(durationMs = 180000): string {
  const sampleRate = 22050;
  const durationSec = Math.max(30, Math.min(300, Math.ceil(durationMs / 1000)));
  const numSamples = sampleRate * durationSec;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // RIFF header
  view.setUint32(0, 0x52494646, false); // 'RIFF'
  view.setUint32(4, 36 + numSamples * 2, true);
  view.setUint32(8, 0x57415645, false); // 'WAVE'
  view.setUint32(12, 0x666d7420, false); // 'fmt '
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 0x64617461, false); // 'data'
  view.setUint32(40, numSamples * 2, true);

  const notes = [130.81, 146.83, 164.81, 174.61, 196.00, 220.00];
  let offset = 44;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const phraseTime = t % 4.5;
    const isPause = phraseTime > 3.8;

    let sample = 0;
    if (!isPause) {
      const syllable = Math.floor(t * 3.2);
      const noteFreq = notes[syllable % notes.length];
      const vibrato = 1 + 0.012 * Math.sin(2 * Math.PI * 4.5 * t);
      const freq = noteFreq * vibrato;

      const f1 = Math.sin(2 * Math.PI * freq * t);
      const f2 = 0.35 * Math.sin(2 * Math.PI * freq * 2 * t);
      const f3 = 0.15 * Math.sin(2 * Math.PI * freq * 3 * t);
      const envelope = Math.sin((t % (1 / 3.2)) * 3.2 * Math.PI);

      sample = (f1 + f2 + f3) * envelope * 0.22;
    }

    const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    view.setInt16(offset, intSample, true);
    offset += 2;
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

class AudiobookAudioEngine {
  private audioElement: HTMLAudioElement;
  private saveStateIntervalId: any = null;
  private saveHistoryIntervalId: any = null;
  private cachedObjectUrls: Map<string, string> = new Map();

  // State Info
  public currentBookId: number | null = null;
  public currentVersionId: number | null = null;
  public files: BookFile[] = [];
  public chapters: BookChapter[] = [];
  public currentFileIndex = -1;
  public currentChapterTitle = '';
  private currentLocalPosition = 0; // ms
  private playbackRate = 1.0;
  private volume = 1.0;

  // Absolute Offsets
  public fileStartOffsets: number[] = [];
  public globalDurationMs = 0;

  private isDemoMode = false;
  private isPlaying = false;
  private currentBookCover = '';
  private currentBookTitle = '';
  private currentNarrator = '';

  // Callbacks for UI updates
  private onPlaybackStateListeners: AudioStateCallback[] = [];
  private onPositionListeners: PositionCallback[] = [];
  private onDurationListeners: DurationCallback[] = [];
  private onFileChangedListeners: FileChangedCallback[] = [];
  private onChapterListeners: ChapterCallback[] = [];

  constructor() {
    this.audioElement = new Audio();
    this.audioElement.preload = 'auto';
    (this.audioElement as any).playsInline = true;

    // Attach HTML5 audio events
    this.audioElement.addEventListener('timeupdate', this.handleElementTimeUpdate.bind(this));
    this.audioElement.addEventListener('durationchange', this.handleElementDurationChange.bind(this));
    this.audioElement.addEventListener('ended', this.handleElementEnded.bind(this));
    this.audioElement.addEventListener('play', () => this.notifyPlaybackState(true));
    this.audioElement.addEventListener('playing', () => this.notifyPlaybackState(true));
    this.audioElement.addEventListener('pause', () => this.notifyPlaybackState(false));
    this.audioElement.addEventListener('abort', () => this.notifyPlaybackState(false));

    // Visibility change handler for seamless background restoration
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.audioElement) {
          const actualLocalMs = Math.floor(this.audioElement.currentTime * 1000);
          this.currentLocalPosition = actualLocalMs;
          const globalPos = this.getGlobalPosition();
          this.notifyPosition(globalPos);
          this.updateChapterForGlobalPosition(globalPos);
        }
      });
    }

    // Global Headphone Hook & Media Keys Listener
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e: KeyboardEvent) => {
        const key = e.key;
        const code = e.code;
        const keyCode = e.keyCode;

        // Headset single click, play/pause keys
        if (
          key === 'MediaPlayPause' ||
          code === 'MediaPlayPause' ||
          key === 'HeadsetHook' ||
          keyCode === 179 ||
          keyCode === 79 ||
          key === 'F24'
        ) {
          e.preventDefault();
          this.togglePlay();
        } else if (key === 'MediaPlay') {
          e.preventDefault();
          this.play();
        } else if (key === 'MediaPause' || key === 'MediaStop') {
          e.preventDefault();
          this.pause();
        } else if (key === 'MediaTrackNext') {
          e.preventDefault();
          this.nextTrack();
        } else if (key === 'MediaTrackPrevious') {
          e.preventDefault();
          this.prevTrack();
        }
      });
    }

    // Periodic Save state every 5 seconds
    this.saveStateIntervalId = setInterval(() => {
      this.saveCurrentPlaybackState();
    }, 5000);

    // Periodic History write every 3 minutes
    this.saveHistoryIntervalId = setInterval(() => {
      this.saveHistoryEntrance();
    }, 180000);

    // Setup Media Session locks
    this.setupMediaSessionHandlers();
  }

  // Subscriptions
  subscribePlaybackState(cb: AudioStateCallback) {
    this.onPlaybackStateListeners.push(cb);
    return () => { this.onPlaybackStateListeners = this.onPlaybackStateListeners.filter(x => x !== cb); };
  }

  subscribePosition(cb: PositionCallback) {
    this.onPositionListeners.push(cb);
    return () => { this.onPositionListeners = this.onPositionListeners.filter(x => x !== cb); };
  }

  subscribeDuration(cb: DurationCallback) {
    this.onDurationListeners.push(cb);
    return () => { this.onDurationListeners = this.onDurationListeners.filter(x => x !== cb); };
  }

  subscribeFileChanged(cb: FileChangedCallback) {
    this.onFileChangedListeners.push(cb);
    return () => { this.onFileChangedListeners = this.onFileChangedListeners.filter(x => x !== cb); };
  }

  subscribeChapter(cb: ChapterCallback) {
    this.onChapterListeners.push(cb);
    return () => { this.onChapterListeners = this.onChapterListeners.filter(x => x !== cb); };
  }

  // --- Real-Time Callback Triggers ---
  private notifyPlaybackState(isPlaying: boolean) {
    this.isPlaying = isPlaying;
    this.onPlaybackStateListeners.forEach(cb => cb(isPlaying));
    this.updateMediaSessionPlaybackState();
  }

  private notifyPosition(positionMs: number) {
    this.onPositionListeners.forEach(cb => cb(positionMs));
    this.updateMediaSessionPositionState(positionMs);
  }

  private notifyDuration(durationMs: number) {
    this.onDurationListeners.forEach(cb => cb(durationMs));
  }

  private notifyFileChanged(index: number) {
    this.onFileChangedListeners.forEach(cb => cb(index));
  }

  private notifyChapter(title: string) {
    this.currentChapterTitle = title;
    this.onChapterListeners.forEach(cb => cb(title));
  }

  // --- Audio Engine Core Loading ---
  async loadVersion(bookId: number, versionId: number, startFileId?: number, startPositionMs = 0) {
    this.pause();

    this.currentBookId = bookId;
    this.currentVersionId = versionId;

    this.files = await db.getFiles(versionId);
    
    // Calculate global positions for all chapters of this version
    this.chapters = [];
    for (const f of this.files) {
      const fChapters = await db.getChapters(f.id);
      this.chapters.push(...fChapters);
    }

    if (this.files.length === 0) {
      console.warn('[AUDIO] No files associated with this version');
      return;
    }

    // Determine target start file index
    this.currentFileIndex = 0;
    if (startFileId !== undefined) {
      const foundIdx = this.files.findIndex(f => f.id === startFileId);
      if (foundIdx !== -1) {
        this.currentFileIndex = foundIdx;
      } else {
        startPositionMs = 0;
      }
    }

    this.calculateOffsets();
    this.loadCurrentFile(startPositionMs);

    // Apply metadata to Media Session UI
    const book = await db.getBookById(bookId);
    if (book) {
      this.currentBookTitle = book.folderName;
      this.currentBookCover = book.coverUrl || '';
      const versions = await db.getVersions(bookId);
      this.currentNarrator = versions.find(v => v.id === versionId)?.voiceActor || 'Narrator';
      this.updateMediaSessionMetadata(this.currentBookTitle, this.currentNarrator, this.currentBookCover);
    }
  }

  private calculateOffsets() {
    this.globalDurationMs = 0;
    this.fileStartOffsets = [];

    this.files.forEach((f) => {
      this.fileStartOffsets.push(this.globalDurationMs);
      this.globalDurationMs += f.durationMs;
    });

    // Update global start times on chapters
    this.chapters.forEach((ch) => {
      const fileIdx = this.files.findIndex(f => f.id === ch.fileId);
      if (fileIdx !== -1) {
        ch.globalStartMs = this.fileStartOffsets[fileIdx] + ch.startTimeMs;
      } else {
        ch.globalStartMs = ch.startTimeMs;
      }
    });

    this.notifyDuration(this.globalDurationMs);
  }

  private getFileUrl(fileData: BookFile): string {
    if (fileData.fileObject) {
      const key = `file_${fileData.id}_${fileData.fileObject.name}`;
      if (!this.cachedObjectUrls.has(key)) {
        this.cachedObjectUrls.set(key, URL.createObjectURL(fileData.fileObject));
      }
      return this.cachedObjectUrls.get(key)!;
    }

    if (fileData.filePath.startsWith('DEMO_')) {
      const key = `demo_${fileData.id}_${fileData.durationMs}`;
      if (!this.cachedObjectUrls.has(key)) {
        this.cachedObjectUrls.set(key, generateDemoAudioBlobUrl(fileData.durationMs));
      }
      return this.cachedObjectUrls.get(key)!;
    }

    return fileData.filePath;
  }

  private loadCurrentFile(startPosMs = 0) {
    if (this.currentFileIndex < 0 || this.currentFileIndex >= this.files.length) return;

    const fileData = this.files[this.currentFileIndex];
    console.log(`[AUDIO] Loading file: ${fileData.fileName} starting at ${startPosMs}ms`);

    this.currentLocalPosition = startPosMs;
    const globalPos = this.getGlobalPosition();
    this.notifyPosition(globalPos);
    this.updateChapterForGlobalPosition(globalPos);

    this.isDemoMode = fileData.filePath.startsWith('DEMO_');
    const audioUrl = this.getFileUrl(fileData);

    if (audioUrl) {
      if (this.audioElement.src !== audioUrl) {
        this.audioElement.src = audioUrl;
      }
      this.audioElement.playbackRate = this.playbackRate;
      this.audioElement.volume = this.volume;
      this.audioElement.currentTime = startPosMs / 1000;
    }

    this.notifyFileChanged(this.currentFileIndex);
  }

  // --- Controls ---
  togglePlay() {
    if (this.isPlaying && !this.audioElement.paused) {
      this.pause();
    } else {
      this.play();
    }
  }

  play() {
    this.isPlaying = true;
    if (this.audioElement) {
      const playPromise = this.audioElement.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            this.notifyPlaybackState(true);
          })
          .catch((err) => {
            console.warn('[AUDIO] Autoplay/Play interrupted:', err);
            this.notifyPlaybackState(false);
          });
      }
    }
    this.updateMediaSessionPlaybackState();
  }

  pause() {
    this.isPlaying = false;
    if (this.audioElement) {
      this.audioElement.pause();
    }
    this.notifyPlaybackState(false);
    this.updateMediaSessionPlaybackState();
    this.saveCurrentPlaybackState();
    this.saveHistoryEntrance();
  }

  nextTrack() {
    if (this.currentFileIndex < this.files.length - 1) {
      this.currentFileIndex++;
      this.loadCurrentFile(0);
      this.play();
    }
  }

  prevTrack() {
    if (this.currentLocalPosition > 3000 || this.currentFileIndex <= 0) {
      this.setGlobalPosition(this.fileStartOffsets[this.currentFileIndex] || 0);
    } else {
      this.currentFileIndex--;
      this.loadCurrentFile(0);
      this.play();
    }
  }

  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1.0, vol));
    if (this.audioElement) {
      this.audioElement.volume = this.volume;
    }
  }

  setPlaybackRate(rate: number) {
    this.playbackRate = Math.max(0.5, Math.min(3.0, rate));
    if (this.audioElement) {
      this.audioElement.playbackRate = this.playbackRate;
    }
    this.updateMediaSessionPositionState(this.getGlobalPosition());
  }

  getPlaybackRate() {
    return this.playbackRate;
  }

  getVolume() {
    return this.volume;
  }

  getGlobalPosition(): number {
    if (this.currentFileIndex < 0 || this.currentFileIndex >= this.fileStartOffsets.length) {
      return 0;
    }
    const fileOffset = this.fileStartOffsets[this.currentFileIndex] || 0;
    return fileOffset + this.currentLocalPosition;
  }

  setGlobalPosition(globalMs: number) {
    if (this.files.length === 0) return;

    const ms = Math.max(0, Math.min(this.globalDurationMs, globalMs));

    // Find target file index that aligns with this position
    let targetFileIndex = 0;
    for (let i = 0; i < this.fileStartOffsets.length; i++) {
      if (ms >= this.fileStartOffsets[i]) {
        targetFileIndex = i;
      } else {
        break;
      }
    }

    const localMs = ms - (this.fileStartOffsets[targetFileIndex] || 0);
    const isCurrentFile = targetFileIndex === this.currentFileIndex;
    this.currentFileIndex = targetFileIndex;

    const wasPlaying = this.isPlaying;

    if (!isCurrentFile) {
      this.loadCurrentFile(localMs);
      if (wasPlaying) {
        this.play();
      }
    } else {
      this.currentLocalPosition = localMs;
      if (this.audioElement) {
        this.audioElement.currentTime = localMs / 1000;
      }
      this.notifyPosition(ms);
      this.updateChapterForGlobalPosition(ms);
    }
  }

  seekRelative(deltaMs: number) {
    const currentGlobal = this.getGlobalPosition();
    this.setGlobalPosition(currentGlobal + deltaMs);
  }

  // --- Element HTML5 Observers ---
  private handleElementTimeUpdate() {
    if (!this.audioElement) return;
    this.currentLocalPosition = Math.floor(this.audioElement.currentTime * 1000);
    const globalPos = this.getGlobalPosition();
    this.notifyPosition(globalPos);
    this.updateChapterForGlobalPosition(globalPos);
  }

  private handleElementDurationChange() {
    if (!this.audioElement || this.currentFileIndex < 0) return;
    const duration = Math.floor(this.audioElement.duration * 1000);
    if (duration > 0 && !this.isDemoMode && this.files[this.currentFileIndex]?.durationMs !== duration) {
      const fileId = this.files[this.currentFileIndex].id;
      db.updateFileDuration(fileId, duration).then(() => {
        if (this.files[this.currentFileIndex]) {
          this.files[this.currentFileIndex].durationMs = duration;
        }
        this.calculateOffsets();
      });
    }
  }

  private handleElementEnded() {
    this.handleTrackEnding();
  }

  private handleTrackEnding() {
    if (this.currentFileIndex < this.files.length - 1) {
      console.log('[AUDIO] Advancing to next part in audiobook sequence in background...');
      this.currentFileIndex++;
      this.loadCurrentFile(0);
      this.play();
    } else {
      console.log('[AUDIO] Audiobook reached completion!');
      this.pause();
      this.setGlobalPosition(0);
    }
  }

  // --- Active Chapter Observer ---
  private updateChapterForGlobalPosition(globalPos: number) {
    if (this.chapters.length === 0) {
      if (this.currentChapterTitle !== '') {
        this.notifyChapter('');
      }
      return;
    }

    let foundChapter = '';
    for (let i = this.chapters.length - 1; i >= 0; i--) {
      const ch = this.chapters[i];
      if (ch.globalStartMs !== undefined && globalPos >= ch.globalStartMs) {
        foundChapter = ch.title;
        break;
      }
    }

    if (foundChapter === '' && this.chapters[0]) {
      foundChapter = this.chapters[0].title;
    }

    if (foundChapter !== this.currentChapterTitle) {
      this.notifyChapter(foundChapter);
    }
  }

  // --- SQLite Equivalent Persistence Sync ---
  private saveCurrentPlaybackState() {
    if (this.currentBookId === null || this.currentVersionId === null || this.currentFileIndex < 0) return;

    const activeFile = this.files[this.currentFileIndex];
    if (!activeFile) return;

    const state: PlaybackState = {
      bookId: this.currentBookId,
      activeVersionId: this.currentVersionId,
      currentFileId: activeFile.id,
      positionMs: this.currentLocalPosition,
      lastPlayedTs: Math.floor(Date.now() / 1000),
    };

    db.savePlaybackState(state).catch((err) => {
      console.error('[AUDIO] State write failed:', err);
    });
  }

  private saveHistoryEntrance() {
    if (this.currentBookId === null || this.currentVersionId === null || this.currentFileIndex < 0) return;

    const activeFile = this.files[this.currentFileIndex];
    if (!activeFile) return;

    db.saveHistoryEntry({
      timestamp: Math.floor(Date.now() / 1000),
      bookId: this.currentBookId,
      versionId: this.currentVersionId,
      fileId: activeFile.id,
      positionMs: this.currentLocalPosition,
    }).catch((err) => {
      console.error('[AUDIO] History write failed:', err);
    });
  }

  // --- Android & Mobile Media Session lock & notification widgets ---
  private setupMediaSessionHandlers() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.setActionHandler('play', () => this.play());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('stop', () => this.pause());

      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const skipTime = (details.seekOffset || 10) * 1000;
        this.seekRelative(-skipTime);
      });

      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const skipTime = (details.seekOffset || 10) * 1000;
        this.seekRelative(skipTime);
      });

      navigator.mediaSession.setActionHandler('previoustrack', () => {
        this.prevTrack();
      });

      navigator.mediaSession.setActionHandler('nexttrack', () => {
        this.nextTrack();
      });

      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && details.seekTime !== null) {
          // seekTime is in seconds relative to current track
          const targetLocalMs = Math.floor(details.seekTime * 1000);
          const fileOffset = this.fileStartOffsets[this.currentFileIndex] || 0;
          this.setGlobalPosition(fileOffset + targetLocalMs);
        }
      });
    } catch (e) {
      console.warn('[AUDIO] MediaSession action registration issue:', e);
    }
  }

  private updateMediaSessionMetadata(title: string, narrator: string, cover?: string) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title || 'Audiobook',
        artist: narrator || 'Narrator',
        album: 'AudioECO Library',
        artwork: cover ? [
          { src: cover, sizes: '512x512', type: 'image/jpeg' }
        ] : [
          { src: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=512', sizes: '512x512', type: 'image/jpeg' }
        ]
      });
    } catch (e) {
      console.warn('[AUDIO] MediaSession metadata update failed:', e);
    }
  }

  private updateMediaSessionPlaybackState() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : 'paused';
    } catch {}
  }

  private updateMediaSessionPositionState(positionMs: number) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    if (!('setPositionState' in navigator.mediaSession)) return;

    try {
      const activeFile = this.files[this.currentFileIndex];
      const durationSec = activeFile ? activeFile.durationMs / 1000 : this.globalDurationMs / 1000;
      const positionSec = Math.min(this.currentLocalPosition / 1000, durationSec);

      if (durationSec > 0 && !isNaN(positionSec)) {
        navigator.mediaSession.setPositionState({
          duration: durationSec,
          playbackRate: this.playbackRate,
          position: Math.max(0, positionSec),
        });
      }
    } catch {}
  }
}

export const audioEngine = new AudiobookAudioEngine();
export type { AudioStateCallback, PositionCallback, DurationCallback, FileChangedCallback, ChapterCallback };
