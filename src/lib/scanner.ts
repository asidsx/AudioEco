/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db } from './db';
import { extractOrGenerateChapters, parseCueSheet } from './chapterParser';

export function parseFilename(filename: string): { partNumber: number; voiceActor: string; cleanTitle: string } {
  let partNumber = 999;
  let voiceActor = 'Default Narrator';

  // Stripping extension
  const baseName = filename.replace(/\.[^/.]+$/, '');

  // Regex 1: look for 'part_X', 'part X', 'Part0X', 'Chapter X', 'ch X'
  const partMatch = baseName.match(/(?:[Pp]art|[Cc]hapter|[Cc]h)[_\s]*(\d+)/i);
  if (partMatch) {
    partNumber = parseInt(partMatch[1], 10);
  } else {
    // Fallback: search for first sequence of numbers in file
    const numMatch = baseName.match(/(\d+)/);
    if (numMatch) {
      partNumber = parseInt(numMatch[1], 10);
    }
  }

  // Regex 2: Voice Actor suffix, look for tail _Name or -Name before extension
  // Matches e.g. "The Time Machine_Algieba" -> "Algieba"
  const TailRegex = /[_-]([A-Za-z\u0400-\u04FF]+)$/;
  const voiceMatch = baseName.match(TailRegex);
  if (voiceMatch) {
    const matchedVoice = voiceMatch[1];
    // Avoid common keywords as narrator name
    const badWords = ['mp3', 'part', 'chapter', 'translated', 'audiobook', 'wav', 'm4a', 'ogg', 'flac', 'aac'];
    if (!badWords.includes(matchedVoice.toLowerCase())) {
      voiceActor = matchedVoice + ' Voice';
    }
  }

  const cleanTitle = baseName
    .replace(/[_-]([A-Za-z\u0400-\u04FF]+)$/, '')
    .replace(/^[0-9\s_-]+/, '')
    .replace(/_/g, ' ')
    .trim() || baseName;

  return { partNumber, voiceActor, cleanTitle };
}

// Function to calculate audio duration using temporary Audio Objects
async function getAudioDurationMs(file: File): Promise<number> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.src = objectUrl;

    const timeout = setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      resolve(180000); // Fail-safe default 3 mins if loading times out
    }, 6000);

    audio.onloadedmetadata = () => {
      clearTimeout(timeout);
      const durationMs = Math.round(audio.duration * 1000);
      URL.revokeObjectURL(objectUrl);
      resolve(durationMs > 0 ? durationMs : 180000);
    };

    audio.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(objectUrl);
      resolve(240000); // Fallback 4 mins
    };
  });
}

export async function scanUploadedFiles(fileList: FileList | File[]): Promise<string> {
  const allFiles = Array.from(fileList);
  const audioFiles = allFiles.filter((f) =>
    /\.(mp3|m4a|m4b|wav|ogg|aac|flac)$/i.test(f.name)
  );
  const cueFiles = allFiles.filter((f) => /\.cue$/i.test(f.name));

  console.log(`[SCANNER] Received ${audioFiles.length} audio files and ${cueFiles.length} CUE files!`);
  if (audioFiles.length === 0) {
    throw new Error('No compatible audiobook file formats detected (mp3, m4a, m4b, wav, ogg, flac, etc.)');
  }

  // Pre-parse CUE sheets if available
  const cueMap: { [baseName: string]: string } = {};
  for (const cueFile of cueFiles) {
    try {
      const text = await cueFile.text();
      const base = cueFile.name.replace(/\.[^/.]+$/, '').toLowerCase();
      cueMap[base] = text;
    } catch (e) {
      console.warn('[SCANNER] Failed to read CUE file:', e);
    }
  }

  // Step 1: Group files by folder/directory parent or fallback to a custom group name
  const groupedBooks: { [bookName: string]: File[] } = {};

  audioFiles.forEach((file) => {
    let folderName = 'Uploaded Audiobook';
    const relativePath = (file as any).webkitRelativePath;
    if (relativePath) {
      const parts = relativePath.split('/');
      if (parts.length > 1) {
        folderName = parts[0]; // The root folder uploaded
      }
    } else {
      // Guess from common file prefixes
      const words = file.name.split(/[_-]/);
      if (words.length > 1) {
        folderName = words[0].trim();
      }
    }

    if (!groupedBooks[folderName]) {
      groupedBooks[folderName] = [];
    }
    groupedBooks[folderName].push(file);
  });

  const processedTitles: string[] = [];

  for (const [folderName, files] of Object.entries(groupedBooks)) {
    // Save Book inside our db
    const bookId = await db.saveBook({
      folderName: folderName,
      path: `/books/uploaded/${folderName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      author: 'Unknown Author',
      coverUrl: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400&auto=format&fit=crop&q=80',
    });

    processedTitles.push(folderName);

    // Group files inside this book by voice actor version
    const versions: { [voiceActor: string]: { file: File; partNumber: number; cleanTitle: string }[] } = {};

    for (const file of files) {
      const { partNumber, voiceActor, cleanTitle } = parseFilename(file.name);
      if (!versions[voiceActor]) {
        versions[voiceActor] = [];
      }
      versions[voiceActor].push({ file, partNumber, cleanTitle });
    }

    // Process versions and save their parts
    for (const [voiceActor, parts] of Object.entries(versions)) {
      const versionId = await db.saveVersion({
        bookId,
        voiceActor,
      });

      // Sort files by part number
      parts.sort((a, b) => a.partNumber - b.partNumber);

      for (let index = 0; index < parts.length; index++) {
        const item = parts[index];
        const durationMs = await getAudioDurationMs(item.file);

        const fileId = await db.saveFile({
          versionId,
          fileName: item.file.name,
          filePath: '', // Session dynamic load via fileObject
          partNumber: item.partNumber,
          orderIndex: index,
          durationMs,
          fileObject: item.file, // In-memory file object mapping for player
        });

        // Check if there is an associated CUE sheet
        const fileBase = item.file.name.replace(/\.[^/.]+$/, '').toLowerCase();
        let extractedChapters = [];

        if (cueMap[fileBase]) {
          extractedChapters = parseCueSheet(cueMap[fileBase], durationMs);
        } else {
          // Extract ID3v2/MP4 embedded chapters or dynamically generate without arbitrary limits
          extractedChapters = await extractOrGenerateChapters(
            item.file,
            fileId,
            durationMs,
            item.cleanTitle || `Part ${index + 1}`
          );
        }

        const chaptersToSave = extractedChapters.map((ch) => ({
          title: ch.title,
          startTimeMs: ch.startTimeMs,
          endTimeMs: ch.endTimeMs,
        }));

        await db.saveChaptersBulk(fileId, chaptersToSave);
      }
    }
  }

  return processedTitles.join(', ');
}
