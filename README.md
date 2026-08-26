# 🎧 AudioECO — High-Fidelity Audiobook Player & Pipeline
> **Optimized Web & Native Android Audiobook Manager with Smart Seeking, Multi-Voice Parsing, and Listening Telemetry.**

<p align="center">
  <img src="https://img.shields.io/badge/Version-v2.4.0-indigo?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/Platform-Web%20%7C%20Android-emerald?style=for-the-badge" alt="Platform">
  <img src="https://img.shields.io/badge/Framework-React%2019%20%2B%20Vite%206-blue?style=for-the-badge" alt="Framework">
  <img src="https://img.shields.io/badge/Mobile-Capacitor-orange?style=for-the-badge" alt="Capacitor">
  <img src="https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-black?style=for-the-badge" alt="GitHub Actions">
</p>

---

## 🇷🇺 Русский язык

### ❓ Почему приложение называется **AudioECO**?
Название **AudioECO** (вместо технического черновика *CoreEngine*) отражает философию проекта: **Audio Audiobook Ecosystem** (Экосистема аудиокниг):
* **Ecosystem (Экосистема):** Это не просто воспроизведение одиночного файла. Это полноценная среда, где аудиофайлы автоматически упорядочиваются, поддерживается многоголосая фильтрация («Чтецы» / «Версии»), ведется сквозная аналитика прослушивания, интеллектуальная система закладок и настраиваемый конвейер звука.
* **Eco-friendly (Бережливость):** Приложение работает полностью автономно (Offline-First), деликатно сохраняя ресурсы батареи вашего смартфона и встроенную память благодаря использованию высокооптимизированного движка IndexedDB и кэширования звукового буфера.

---

### 🌟 Основные возможности:
1. **Высокоточная Временная Шкала:** Поддерживает непрерывное воспроизведение нескольких файлов как единой книги с точным расчётом абсолютного времени.
2. **Интеллектуальная перемотка (Undo/Redo Seek):** Кнопки отмены и повтора ошибочных перемоток. Если вы случайно задели шкалу времени, вы можете вернуть позицию в один клик.
3. **История и Телеметрия (Listening Telemetry):** Интеллектуальный журнал точек прослушивания. Каждое изменение сохраняется (при паузе или каждые 3 минуты), позволяя в любой момент сделать «Телепорт» к любому моменту в прошлом.
4. **Конвейер Частей (Parts Registry Pipeline):** Возможность прямо в приложении добавлять, удалять или менять местами файлы книги, гибко выстраивая нужный порядок частей.
5. **Таймер Сна (Sleep Timer):** Плавное затухание громкости с интервалами 15, 30, 45 или 60 минут.
6. **Многоязычность по умолчанию (Smart bilingual UI):** Приложение автоматически считывает настройки смартфона/браузера. Если язык вашей системы русский — интерфейс включится на русском, если английский — на английском. Кнопка ручного выбора позволяет быстро поменять язык в любой момент.

---

### 📂 Как пользоваться:
1. **Синхронизация базовых книг:** Нажмите кнопку **«Синхр. Диск»** (Sync Disk), чтобы мгновенно загрузить в память комплект встроенных классических аудиокниг.
2. **Импорт личной библиотеки:** 
   * Перетащите аудиофайлы (MP3, OGG, WAV, M4A) в область импорта или выберите их вручную.
   * Вы можете импортировать целую папку. Приложение автоматически распределит файлы, определит авторов, названия и отсортирует части.
3. **Редактирование Метаданных:** Открыв плеер, нажмите **«Редактировать»** (Rename), чтобы переименовать книгу или изменить автора. Настройки запишутся прямо в оффлайн-базу.

---

### ⚙️ Компиляция и Локальный запуск
Для работы с кодом локально вам понадобится установленный Node.js 20+.

```bash
# 1. Установите зависимости
npm install

# 2. Запустите сервер разработки
npm run dev
# (Приложение откроется на порту 3000)

# 3. Сборка оптимизированного Web-релиза
npm run build
```

---

### 📱 Автоматическая сборка Android APK через компилятор GitHub

В репозитории настроен полностью автоматический CI/CD флоу на базе **GitHub Actions** (`.github/workflows/android.yml`). Вы можете собирать APK без настройки окружения Java/Android Studio на собственном компьютере!

#### 🛠️ Как это работает при коммите (Push):
Каждый пуш в ветку `main` или `master` запускает компиляцию приложения:
1. Виртуальная машина соберает веб-версию.
2. Инициализируется и синхронизируется нативный код на движке **Capacitor Android**.
3. Происходит компиляция в тестовый APK.
4. Файл выкладывается во вкладке **Actions** в завершенном воркфлоу сборки (в самом низу страницы, в разделе **Artifacts** под именем `audiobook-player-debug-apk`).

#### 🚀 Автокомпиляция и выгрузка Релиза (New Release Trigger):
Когда вы создаете новый официальный **Релиз** (Release) прямо на GitHub:
1. Срабатывает выделенный триггер **`release`**.
2. GitHub Actions компилирует чистую сборку приложения.
3. Копирует полученный APK-файл и даёт ему красивое название **`AudioECO.apk`**.
4. **Автоматически загружает и прикрепляет файл `AudioECO.apk` прямо к вашему релизу на GitHub!** Вы и ваши пользователи сможете скачать готовый файл в один клик прямо со страницы релизов.

---

---

## 🇬🇧 English Language

### ❓ What is the story behind the name **AudioECO**?
The brand name **AudioECO** replaces the generic developer placeholder *CoreEngine*, highlighting two core pillars of the product:
* **Ecosystem (ECO):** Rather than playing a single arbitrary audio file, the application constructs a smart environment where multiple audio parts, version/narrator variants, absolute timeline states, and analytical checkpoints coexist collaboratively.
* **Eco-efficiency (ECO):** Built on highly optimized IndexedDB browser databases, the app acts as an offline-first system, minimizing energy drainage and keeping your mobile battery healthy.

---

### 🌟 Key Features:
1. **Precise Multi-File Time Alignment:** Treat multiple nested tracks as a single, unified audiobook with precise total absolute timeline offsets.
2. **Smart Undo/Redo Seeks:** Accidental touch of the timeline? Instantly revert/forward your timeline state in a single click.
3. **Listening Checkpoints Telemetry:** Tracks and logs your progress points. Let you "teleport" back to previous states instantly.
4. **Parts Registry Sequence:** Change files ordering, append new tracks, or remove custom parts directly inside the native mobile UI.
5. **Sleep Timer:** Gradual fade-out with responsive presets (15, 30, 45, 60 min).
6. **Bilingual UI**: Automatically adapts to your native device default setting (Russian or English), with a fast manual override flag button.

---

### ⚙️ Local Development Instructions

```bash
# Install dependencies
npm install

# Run Vite dev server
npm run dev

# Generate production static bundle
npm run build
```

---

### 📱 Automated Android APK Compilation on GitHub

The repository is fully equipped with **Ionic Capacitor** integrations and integrated cloud pipelines.

1. **On Code Commit (Push):** Compiles and mounts a test APK directly to the GitHub **Actions** page under the **Artifacts** section at the bottom (`audiobook-player-debug-apk`).
2. **On New GitHub Release Publication (Release Trigger):** Triggers a release action automatically, builds the production Android codebase, packages it with a user-friendly name **`AudioECO.apk`**, and **posts the finished APK directly into the assets of download on your GitHub Release page!** No manual setup required.

---

*Made with 💖 by the AudioECO Developer Team.*
