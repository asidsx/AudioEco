/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ParsedChapter {
  title: string;
  startTimeMs: number;
  endTimeMs: number;
}

export interface ParsedAudioMetadata {
  title?: string;
  artist?: string;
  album?: string;
  chapters: ParsedChapter[];
}

/**
 * Decode syncsafe integer (used in ID3v2 tags)
 */
function decodeSyncsafe(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] & 0x7f) << 21) |
    ((bytes[offset + 1] & 0x7f) << 14) |
    ((bytes[offset + 2] & 0x7f) << 7) |
    (bytes[offset + 3] & 0x7f)
  );
}

/**
 * Decode standard 32-bit big-endian integer
 */
function decodeUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  ) >>> 0;
}

/**
 * Read text from ID3v2 frame according to encoding byte
 */
function decodeId3Text(bytes: Uint8Array, offset: number, length: number): string {
  if (length <= 1) return '';
  const encoding = bytes[offset];
  const textBytes = bytes.slice(offset + 1, offset + length);

  try {
    if (encoding === 0) {
      // ISO-8859-1 / Latin-1 or windows-1251
      const decoder = new TextDecoder('windows-1251');
      return decoder.decode(textBytes).replace(/\0+$/, '').trim();
    } else if (encoding === 1) {
      // UTF-16 with BOM
      const decoder = new TextDecoder('utf-16');
      return decoder.decode(textBytes).replace(/\0+$/, '').trim();
    } else if (encoding === 2) {
      // UTF-16BE without BOM
      const decoder = new TextDecoder('utf-16be');
      return decoder.decode(textBytes).replace(/\0+$/, '').trim();
    } else if (encoding === 3) {
      // UTF-8
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(textBytes).replace(/\0+$/, '').trim();
    }
  } catch {
    // Fallback
    return new TextDecoder('utf-8', { fatal: false }).decode(textBytes).replace(/\0+$/, '').trim();
  }

  return new TextDecoder('utf-8', { fatal: false }).decode(textBytes).replace(/\0+$/, '').trim();
}

/**
 * Parse ID3v2 tags (specifically CHAP and CTOC frames, as well as TIT2, TPE1, TALB)
 */
export function parseId3v2Metadata(buffer: ArrayBuffer): ParsedAudioMetadata {
  const bytes = new Uint8Array(buffer);
  const metadata: ParsedAudioMetadata = { chapters: [] };

  // Check ID3 header: 'ID3'
  if (bytes.length < 10 || bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) {
    return metadata;
  }

  const majorVersion = bytes[3]; // 3 for ID3v2.3, 4 for ID3v2.4
  const tagSize = decodeSyncsafe(bytes, 6);
  const tagEnd = Math.min(bytes.length, 10 + tagSize);

  let offset = 10;
  const rawChapters: ParsedChapter[] = [];

  while (offset + 10 <= tagEnd) {
    // Read 4-character frame ID
    const frameId = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3]
    );

    // Padding or end of frames
    if (frameId.charCodeAt(0) === 0) break;

    const frameSize = majorVersion === 4 
      ? decodeSyncsafe(bytes, offset + 4) 
      : decodeUint32BE(bytes, offset + 4);

    if (frameSize <= 0 || offset + 10 + frameSize > tagEnd) break;

    const frameBodyOffset = offset + 10;

    if (frameId === 'CHAP') {
      // Parse ID3 CHAP frame
      // Element ID (null-terminated string)
      let elemIdEnd = frameBodyOffset;
      while (elemIdEnd < frameBodyOffset + frameSize && bytes[elemIdEnd] !== 0) {
        elemIdEnd++;
      }
      const elemIdLen = elemIdEnd - frameBodyOffset + 1; // including null terminator
      const chapHeaderOffset = frameBodyOffset + elemIdLen;

      if (chapHeaderOffset + 16 <= frameBodyOffset + frameSize) {
        const startTimeMs = decodeUint32BE(bytes, chapHeaderOffset);
        const endTimeMs = decodeUint32BE(bytes, chapHeaderOffset + 4);

        let chapterTitle = `Chapter ${rawChapters.length + 1}`;

        // Look for nested subframes inside CHAP (e.g. TIT2 frame for chapter title)
        const subframesOffset = chapHeaderOffset + 16;
        let subOffset = subframesOffset;
        const chapEnd = frameBodyOffset + frameSize;

        while (subOffset + 10 <= chapEnd) {
          const subFrameId = String.fromCharCode(
            bytes[subOffset],
            bytes[subOffset + 1],
            bytes[subOffset + 2],
            bytes[subOffset + 3]
          );

          if (subFrameId.charCodeAt(0) === 0) break;

          const subFrameSize = majorVersion === 4
            ? decodeSyncsafe(bytes, subOffset + 4)
            : decodeUint32BE(bytes, subOffset + 4);

          if (subFrameSize <= 0 || subOffset + 10 + subFrameSize > chapEnd) break;

          if (subFrameId === 'TIT2') {
            const decodedTitle = decodeId3Text(bytes, subOffset + 10, subFrameSize);
            if (decodedTitle) {
              chapterTitle = decodedTitle;
            }
          }

          subOffset += 10 + subFrameSize;
        }

        rawChapters.push({
          title: chapterTitle,
          startTimeMs,
          endTimeMs: endTimeMs > startTimeMs ? endTimeMs : startTimeMs + 60000,
        });
      }
    } else if (frameId === 'TIT2') {
      metadata.title = decodeId3Text(bytes, frameBodyOffset, frameSize);
    } else if (frameId === 'TPE1') {
      metadata.artist = decodeId3Text(bytes, frameBodyOffset, frameSize);
    } else if (frameId === 'TALB') {
      metadata.album = decodeId3Text(bytes, frameBodyOffset, frameSize);
    }

    offset += 10 + frameSize;
  }

  // Sort chapters by start time
  rawChapters.sort((a, b) => a.startTimeMs - b.startTimeMs);
  metadata.chapters = rawChapters;
  return metadata;
}

/**
 * Parse MP4 / M4A / M4B Nero chapters (chpl atom) and QuickTime metadata
 */
export function parseMp4Metadata(buffer: ArrayBuffer): ParsedAudioMetadata {
  const data = new DataView(buffer);
  const metadata: ParsedAudioMetadata = { chapters: [] };

  function findAtom(start: number, end: number, targetType: string): { offset: number; size: number } | null {
    let offset = start;
    while (offset + 8 <= end) {
      const size = data.getUint32(offset);
      const type = String.fromCharCode(
        data.getUint8(offset + 4),
        data.getUint8(offset + 5),
        data.getUint8(offset + 6),
        data.getUint8(offset + 7)
      );

      if (size < 8) break;

      if (type === targetType) {
        return { offset: offset + 8, size: size - 8 };
      }

      // If container atom, search inside
      if (['moov', 'trak', 'mdia', 'minf', 'stbl', 'udta', 'meta', 'ilst'].includes(type)) {
        const nestedStart = offset + (type === 'meta' ? 12 : 8); // meta has 4 bytes flags/version
        const found = findAtom(nestedStart, offset + size, targetType);
        if (found) return found;
      }

      offset += size;
    }
    return null;
  }

  try {
    const chplAtom = findAtom(0, Math.min(data.byteLength, 16 * 1024 * 1024), 'chpl');
    if (chplAtom) {
      const offset = chplAtom.offset;
      const version = data.getUint8(offset);
      let chapterCount = 0;
      let cur = offset + 4; // Skip version(1) + flags(3)

      if (version === 1) {
        cur += 4; // extra reserved 4 bytes
        chapterCount = data.getUint32(cur);
        cur += 4;
      } else {
        cur += 1; // reserved 1 byte
        chapterCount = data.getUint8(cur);
        cur += 1;
      }

      const chapters: ParsedChapter[] = [];
      const decoder = new TextDecoder('utf-8');

      for (let i = 0; i < chapterCount && cur + 9 <= offset + chplAtom.size; i++) {
        // 64-bit timestamp in 100ns units (10,000,000 units per second)
        const high = data.getUint32(cur);
        const low = data.getUint32(cur + 4);
        cur += 8;

        const timeIn100ns = high * 4294967296 + low;
        const startTimeMs = Math.floor(timeIn100ns / 10000);

        const titleLen = data.getUint8(cur);
        cur += 1;

        let title = `Chapter ${i + 1}`;
        if (titleLen > 0 && cur + titleLen <= offset + chplAtom.size) {
          const titleBytes = new Uint8Array(buffer, cur, titleLen);
          title = decoder.decode(titleBytes).trim() || title;
          cur += titleLen;
        }

        chapters.push({
          title,
          startTimeMs,
          endTimeMs: 0,
        });
      }

      // Fill in end times
      for (let i = 0; i < chapters.length; i++) {
        if (i < chapters.length - 1) {
          chapters[i].endTimeMs = chapters[i + 1].startTimeMs;
        } else {
          chapters[i].endTimeMs = chapters[i].startTimeMs + 300000;
        }
      }

      metadata.chapters = chapters;
    }
  } catch (err) {
    console.warn('[PARSER] Failed to parse MP4 chapters:', err);
  }

  return metadata;
}

/**
 * Parse CUE sheet content
 */
export function parseCueSheet(cueText: string, totalDurationMs = 0): ParsedChapter[] {
  const chapters: ParsedChapter[] = [];
  const lines = cueText.split(/\r?\n/);

  let currentTitle = '';
  let currentStartMs: number | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for TRACK
    if (/^TRACK\s+\d+\s+AUDIO/i.test(trimmed)) {
      if (currentStartMs !== null) {
        chapters.push({
          title: currentTitle || `Track ${chapters.length + 1}`,
          startTimeMs: currentStartMs,
          endTimeMs: 0,
        });
      }
      currentTitle = '';
      currentStartMs = null;
    }

    // Check for TITLE
    const titleMatch = trimmed.match(/^TITLE\s+"?([^"]+)"?/i);
    if (titleMatch && !currentTitle) {
      currentTitle = titleMatch[1].trim();
    }

    // Check for INDEX 01 mm:ss:ff (75 frames per second)
    const indexMatch = trimmed.match(/^INDEX\s+01\s+(\d+):(\d+):(\d+)/i);
    if (indexMatch) {
      const mins = parseInt(indexMatch[1], 10);
      const secs = parseInt(indexMatch[2], 10);
      const frames = parseInt(indexMatch[3], 10);
      currentStartMs = (mins * 60 + secs) * 1000 + Math.floor((frames / 75) * 1000);
    }
  }

  if (currentStartMs !== null) {
    chapters.push({
      title: currentTitle || `Track ${chapters.length + 1}`,
      startTimeMs: currentStartMs,
      endTimeMs: totalDurationMs > currentStartMs ? totalDurationMs : currentStartMs + 180000,
    });
  }

  // Calculate end times
  for (let i = 0; i < chapters.length; i++) {
    if (i < chapters.length - 1) {
      chapters[i].endTimeMs = chapters[i + 1].startTimeMs;
    } else if (totalDurationMs > chapters[i].startTimeMs) {
      chapters[i].endTimeMs = totalDurationMs;
    }
  }

  return chapters;
}

/**
 * Extract embedded chapters or automatically generate full chapter subdivisions WITHOUT artificial limits
 */
export async function extractOrGenerateChapters(
  file: File,
  fileId: number,
  durationMs: number,
  fallbackBaseTitle = ''
): Promise<ParsedChapter[]> {
  try {
    // Read first 2MB to extract ID3v2 or MP4 tags
    const sampleSize = Math.min(file.size, 2 * 1024 * 1024);
    const slice = file.slice(0, sampleSize);
    const arrayBuffer = await slice.arrayBuffer();

    let meta: ParsedAudioMetadata = { chapters: [] };

    if (/\.(mp3)$/i.test(file.name)) {
      meta = parseId3v2Metadata(arrayBuffer);
    } else if (/\.(m4a|m4b|mp4|aac)$/i.test(file.name)) {
      meta = parseMp4Metadata(arrayBuffer);
    }

    // If real embedded chapters were found, adjust final end time and return ALL of them!
    if (meta.chapters && meta.chapters.length > 0) {
      console.log(`[PARSER] Found ${meta.chapters.length} embedded chapters in ${file.name}`);
      const validChapters = meta.chapters.map((ch, idx, arr) => ({
        title: ch.title || `Chapter ${idx + 1}`,
        startTimeMs: ch.startTimeMs,
        endTimeMs: idx === arr.length - 1 && durationMs > ch.startTimeMs ? durationMs : ch.endTimeMs,
      }));
      return validChapters;
    }
  } catch (err) {
    console.warn(`[PARSER] Embedded tag parsing failed for ${file.name}:`, err);
  }

  // --- Automatic Smart Chapter Generation (NO 6-CHAPTER LIMIT!) ---
  // For files with no embedded tags:
  // If file is short (< 6 minutes): 1 chapter
  // If file is longer: create chapters every 5 to 10 minutes according to duration
  const chaptersList: ParsedChapter[] = [];

  const baseTitle = fallbackBaseTitle || file.name.replace(/\.[^/.]+$/, '').replace(/^[0-9\s_-]+/, '').trim() || 'Chapter';

  if (durationMs <= 360000) {
    // Under 6 minutes: 1 single clean chapter
    chaptersList.push({
      title: baseTitle,
      startTimeMs: 0,
      endTimeMs: durationMs,
    });
  } else {
    // For longer audiobooks, divide naturally every ~5 to 7.5 minutes without ANY artificial cap of 6!
    // E.g., a 60-minute file gets 10 chapters; a 120-minute file gets 20 chapters; a 10-hour file gets 100 chapters!
    const targetIntervalMs = durationMs > 3600000 ? 600000 : 300000; // 10 mins for >1hr files, 5 mins otherwise
    const chapterCount = Math.max(1, Math.ceil(durationMs / targetIntervalMs));
    const interval = Math.floor(durationMs / chapterCount);

    for (let j = 0; j < chapterCount; j++) {
      const start = j * interval;
      const end = j === chapterCount - 1 ? durationMs : (j + 1) * interval;
      chaptersList.push({
        title: `${baseTitle} — Part ${j + 1}`,
        startTimeMs: start,
        endTimeMs: end,
      });
    }
  }

  return chaptersList;
}
