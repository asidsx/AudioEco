/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Book {
  id: number;
  folderName: string;
  path: string;
  coverUrl?: string;
  author?: string;
}

export interface BookVersion {
  id: number;
  bookId: number;
  voiceActor: string;
}

export interface BookFile {
  id: number;
  versionId: number;
  fileName: string;
  filePath: string; // URL, file path, or object URL
  partNumber: number;
  orderIndex: number;
  durationMs: number;
  fileObject?: File; // Optional actual file object loaded in session
}

export interface BookChapter {
  id: number;
  fileId: number;
  title: string;
  startTimeMs: number;
  endTimeMs: number;
  globalStartMs?: number; // Calculated on load
}

export interface PlaybackState {
  bookId: number;
  activeVersionId: number;
  currentFileId: number;
  positionMs: number;
  lastPlayedTs: number;
}

export interface HistoryEntry {
  id?: number;
  timestamp: number;
  bookId: number;
  versionId: number;
  fileId: number;
  positionMs: number;
}

export type Language = 'en' | 'ru';
