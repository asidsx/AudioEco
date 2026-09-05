import { Language } from './types';

export interface TranslationKeys {
  scanningLocal: string;
  scanComplete: string;
  importedBook: string;
  fileImportFailed: string;
  audiobookRemoved: string;
  deletionFailed: string;
  libraryReset: string;
  resetFailed: string;
  online: string;
  dbEntries: string;
  syncDisk: string;
  scanning: string;
  fileIngestionChannel: string;
  dragDropSub: string;
  selectFiles: string;
  uploadFolder: string;
  indexedLibraryCatalog: string;
  confirmResetQuestion: string;
  resetDatabase: string;
  libraryDbEmpty: string;
  emptySub: string;
  restoreDemoResources: string;
  preloadDemo: string;
  customStream: string;
  deleteBookTooltip: string;
  deleteBookConfirmTooltip: string;
  deleteFileTooltip: string;
  deleteFileConfirmTooltip: string;
  deleteBtn: string;
  back: string;
  rename: string;
  save: string;
  cancel: string;
  bookTitle: string;
  author: string;
  engineActive: string;
  enginePaused: string;
  undoSeek: string;
  redoSeek: string;
  chapters: string;
  history: string;
  speed: string;
  sleep: string;
  sleepOff: string;
  partsRegistryPipeline: string;
  addFiles: string;
  moveUpTooltip: string;
  moveDownTooltip: string;
  chaptersIndex: string;
  filterChapters: string;
  clear: string;
  noRecordsMatching: string;
  totalBufferIndex: string;
  mappedSubdivisions: string;
  listeningTelemetry: string;
  retrievingCheckpoints: string;
  noCheckpointsLogged: string;
  historyEmptySub: string;
  teleport: string;
  historyFooter: string;
  narrator: string;
  backBtn: string;
  editTitle: string;
  editAuthor: string;
  saveBtn: string;
  cancelBtn: string;
  editDetails: string;
  undoTooltip: string;
  redoTooltip: string;
  sleepTimer: string;
  off: string;
  minutesShort: string;
  partsRegistry: string;
  historyTitle: string;
}

export const translations: Record<'en' | 'ru', TranslationKeys> = {
  en: {
    scanningLocal: 'Scanning local audiobooks directory...',
    scanComplete: 'Scan complete! Classical audiobooks retrieved.',
    importedBook: 'Imported book: ',
    fileImportFailed: 'File import failed',
    audiobookRemoved: 'Audiobook removed',
    deletionFailed: 'Deletion failed',
    libraryReset: 'Library reset successfully',
    resetFailed: 'Reset failed',
    online: 'Online',
    dbEntries: 'DB Entries',
    syncDisk: 'Sync Disk',
    scanning: 'Scanning...',
    fileIngestionChannel: 'File Ingestion Channel',
    dragDropSub: 'Accepts MP3, M4A, WAV, OGG. Multi-voice streams will be auto-processed.',
    selectFiles: 'Select Files',
    uploadFolder: 'Upload Folder',
    indexedLibraryCatalog: 'Indexed Library Catalog',
    confirmResetQuestion: 'Confirm Reset?',
    resetDatabase: 'Reset Database',
    libraryDbEmpty: 'Library Database: Empty',
    emptySub: 'Upload raw audiobook files or click Sync Disk to populate high-fidelity system samples!',
    restoreDemoResources: 'Restore Demo Resources',
    preloadDemo: 'PRELOAD_DEMO',
    customStream: 'CUSTOM_STREAM',
    deleteBookTooltip: 'Delete Audiobook',
    deleteBookConfirmTooltip: 'Click again to confirm removal',
    deleteFileTooltip: 'Delete this file',
    deleteFileConfirmTooltip: 'Click again to confirm file deletion',
    deleteBtn: 'Delete?',
    back: 'Back',
    rename: 'Rename',
    save: 'Save',
    cancel: 'Cancel',
    bookTitle: 'Book title',
    author: 'Author',
    engineActive: 'ENGINE_ACTIVE',
    enginePaused: 'ENGINE_PAUSED',
    undoSeek: 'Undo seek jump',
    redoSeek: 'Redo seek jump',
    chapters: 'Chapters',
    history: 'History',
    speed: 'Speed',
    sleep: 'Sleep',
    sleepOff: 'OFF',
    partsRegistryPipeline: 'Parts Registry Pipeline',
    addFiles: 'Add Files',
    moveUpTooltip: 'Move sequence order up',
    moveDownTooltip: 'Move sequence order down',
    chaptersIndex: 'Chapters Index',
    filterChapters: 'Filter chapters...',
    clear: 'Clear',
    noRecordsMatching: 'No records matching',
    totalBufferIndex: 'Total Buffer Index',
    mappedSubdivisions: 'mapped subdivisions',
    listeningTelemetry: 'Listening Telemetry',
    retrievingCheckpoints: 'Retrieving pipeline checkpoints...',
    noCheckpointsLogged: 'No checkpoints logged',
    historyEmptySub: 'Progress checkpoints are auto-saved during pause or every 3 minutes.',
    teleport: 'Teleport',
    historyFooter: 'Click checkpoint to teleport and restore streaming state',
    narrator: 'Narrator',
    backBtn: 'Back',
    editTitle: 'Book title',
    editAuthor: 'Author',
    saveBtn: 'Save',
    cancelBtn: 'Cancel',
    editDetails: 'Rename',
    undoTooltip: 'Undo seek jump',
    redoTooltip: 'Redo seek jump',
    sleepTimer: 'Sleep',
    off: 'OFF',
    minutesShort: 'M',
    partsRegistry: 'Parts Registry Pipeline',
    historyTitle: 'Listening Telemetry',
  },
  ru: {
    scanningLocal: 'Поиск аудиокниг в локальной директории...',
    scanComplete: 'Поиск завершен! Загружены классические аудиокниги.',
    importedBook: 'Книга импортирована: ',
    fileImportFailed: 'Ошибка импорта файлов',
    audiobookRemoved: 'Аудиокнига удалена',
    deletionFailed: 'Не удалось удалить книгу',
    libraryReset: 'Библиотека успешно сброшена',
    resetFailed: 'Сброс не удался',
    online: 'В сети',
    dbEntries: 'Книг в базе',
    syncDisk: 'Синхр. диск',
    scanning: 'Сканирование...',
    fileIngestionChannel: 'Канал импорта файлов',
    dragDropSub: 'Поддерживаются MP3, M4A, WAV, OGG. Файлы с разной озвучкой группируются автоматически.',
    selectFiles: 'Выбрать файлы',
    uploadFolder: 'Загрузить папку',
    indexedLibraryCatalog: 'Каталог библиотеки',
    confirmResetQuestion: 'Подтвердить сброс?',
    resetDatabase: 'Сбросить базу данных',
    libraryDbEmpty: 'База данных библиотеки пуста',
    emptySub: 'Загрузите аудиофайлы вашей книги или нажмите «Синхр. диск» для восстановления демо-книг!',
    restoreDemoResources: 'Восстановить демо-книги',
    preloadDemo: 'ДЕМО_КНИГА',
    customStream: 'СВОЙ_ФАЙЛ',
    deleteBookTooltip: 'Удалить аудиокнигу',
    deleteBookConfirmTooltip: 'Нажмите еще раз для подтверждения удаления',
    deleteFileTooltip: 'Удалить этот файл',
    deleteFileConfirmTooltip: 'Нажмите еще раз для удаления файла',
    deleteBtn: 'Удалить?',
    back: 'Назад',
    rename: 'Переименовать',
    save: 'Сохр.',
    cancel: 'Отмена',
    bookTitle: 'Название книги',
    author: 'Автор',
    engineActive: 'ВОСПРОИЗВЕДЕНИЕ',
    enginePaused: 'ПАУЗА',
    undoSeek: 'Отменить перемотку',
    redoSeek: 'Повторить перемотку',
    chapters: 'Главы',
    history: 'История',
    speed: 'Скорость',
    sleep: 'Таймер',
    sleepOff: 'ВЫКЛ',
    partsRegistryPipeline: 'Части произведения',
    addFiles: 'Файлы',
    moveUpTooltip: 'Переместить часть выше',
    moveDownTooltip: 'Переместить часть ниже',
    chaptersIndex: 'Список глав',
    filterChapters: 'Поиск глав...',
    clear: 'Очистить',
    noRecordsMatching: 'Ничего не найдено по запросу',
    totalBufferIndex: 'Размечено глав всего',
    mappedSubdivisions: 'записей',
    listeningTelemetry: 'Контрольные точки',
    retrievingCheckpoints: 'Загрузка контрольных точек...',
    noCheckpointsLogged: 'История прослушивания пуста',
    historyEmptySub: 'Контрольные точки сохраняются автоматически при паузе или каждые 3 минуты.',
    teleport: 'Перейти',
    historyFooter: 'Нажмите на точку для моментального перемещения к ней',
    narrator: 'Чтец',
    backBtn: 'Назад',
    editTitle: 'Название книги',
    editAuthor: 'Автор',
    saveBtn: 'Сохранить',
    cancelBtn: 'Отмена',
    editDetails: 'Редактировать',
    undoTooltip: 'Отменить перемотку',
    redoTooltip: 'Повторить перемотку',
    sleepTimer: 'Таймер',
    off: 'ВЫКЛ',
    minutesShort: 'м',
    partsRegistry: 'Последовательность частей',
    historyTitle: 'История прослушивания',
  }
};

export const getSystemLanguage = (): 'en' | 'ru' => {
  if (typeof navigator === 'undefined') return 'en';
  const code = (navigator.language || (navigator as any).userLanguage || 'en').toLowerCase();
  return code.startsWith('ru') ? 'ru' : 'en';
};

export const getTranslations = (lang: Language): TranslationKeys => {
  return translations[lang] || translations.en;
};
