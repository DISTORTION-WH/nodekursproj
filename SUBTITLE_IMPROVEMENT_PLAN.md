# План улучшения субтитров — Lume Chat

## Диагноз: что сейчас сломано

Я изучил весь код. Вот **5 критических проблем** текущей реализации:

---

### Проблема 1: Перевод НЕ РАБОТАЕТ ВООБЩЕ

Файл `useTranslate.ts` существует, содержит рабочую функцию `translateText()`, но **нигде не импортируется и не вызывается**. 

В `useLiveSubtitles.ts` входящие субтитры от собеседника показываются как есть:
```typescript
// useLiveSubtitles.ts, строка ~236
const onReceived = (data) => {
  if (!shouldShowRef.current) return;
  upsertSubtitle(data.speakerId, data.username, data.text, data.isFinal);
  // ← текст НЕ переводится, просто отображается
};
```

**Результат**: настройки "Мой язык" и "Язык собеседника" есть в UI, но ничего не делают. Субтитры показываются на языке оригинала без перевода.

---

### Проблема 2: Web Speech API обрывается каждые 30-60 секунд

Текущая логика в `useLiveSubtitles.ts`:
- Создаёт `SpeechRecognition` с `continuous: true`
- На `onend` пересоздаёт через `setTimeout(300ms)`
- **Пробел в 300-500ms** — теряются слова
- Chrome убивает сессию через ~60сек тишины, даже с `continuous: true`
- При ошибке `no-speech` (нет речи 10сек) — тоже умирает
- **Нет pre-warm** — новый экземпляр стартует с задержкой

---

### Проблема 3: Нет троттлинга interim-результатов

Каждый промежуточный результат (interim) сразу отправляется через сокет:
```typescript
// useLiveSubtitles.ts, onresult callback
socketRef.current.emit("subtitle_broadcast", { ...payload, to: remoteUserIdRef.current });
```

Web Speech API выдаёт interim каждые 100-200мс. Это **5-10 сокет-сообщений в секунду** на одного пользователя. При плохом интернете это забивает канал и создаёт лаг.

---

### Проблема 4: Язык распознавания не соответствует говорящему

Текущая логика:
- `rec.lang = displayLang` (язык пользователя, т.е. "Мой язык")
- Это правильно для распознавания СВОЕЙ речи
- Но собеседник говорит на ДРУГОМ языке, и его речь распознаётся на его стороне с ЕГО настройками

**Проблема**: если Пользователь 1 (русский) выбирает "Мой язык: русский, Язык собеседника: английский", то:
- Его речь распознаётся по-русски ✅
- Речь собеседника приходит уже распознанной (собеседник распознаёт у себя) ✅
- Но ПЕРЕВОД входящего текста НЕ ПРОИСХОДИТ ❌

---

### Проблема 5: При смене языка теряется контекст

```typescript
// useLiveSubtitles.ts
useEffect(() => {
  if (callActive && localStream && isSupported) {
    stopRecognition();  // ← убивает текущее распознавание
    const t = setTimeout(() => startRecognition(), 150);  // ← 150мс gap
    return () => clearTimeout(t);
  }
}, [displayLang]);
```

При смене языка полностью перезапускается распознавание — теряется текущая фраза.

---

## План исправления (7 шагов)

### Шаг 1: Подключить перевод входящих субтитров [$0]

**Файл**: `apps/web/src/hooks/useLiveSubtitles.ts`

Что сделать:
- Импортировать `translateText` из `useTranslate.ts`
- В обработчике `subtitle_received` перед `upsertSubtitle()` вызывать перевод
- Для `interim` (не финальных) — переводить с дебаунсом (не каждый раз)
- Для `final` — переводить всегда
- Использовать `speechLang` как source language (язык собеседника)
- Использовать `displayLang` как target language (мой язык)
- Если source === target — не переводить (оптимизация)

Также:
- Передавать `lang` в payload `subtitle_broadcast`, чтобы получатель знал исходный язык
- На стороне сервера (`index.ts`, событие `subtitle_broadcast`) — уже передаёт `lang`, но клиент его не использует

```
Поток данных ПОСЛЕ исправления:

Пользователь 2 говорит (англ.)
    → Web Speech API распознаёт текст ("Hello, how are you?")
    → Отправляет через сокет: { text, lang: "en-US", isFinal, ... }
    → Пользователь 1 получает через subtitle_received
    → translateText("Hello, how are you?", "en-US", "ru-RU")
    → Показывает: "Привет, как дела?"
```

---

### Шаг 2: Сделать Web Speech API стабильнее [$0]

**Файл**: `apps/web/src/hooks/useLiveSubtitles.ts`

Что сделать:

**2a) Double-buffering (два экземпляра)**
- Держать два SpeechRecognition: `active` и `standby`
- Пока `active` работает — `standby` уже создан и готов к запуску
- Когда `active` умирает (`onend`) — мгновенно переключаемся на `standby`
- Создаём новый `standby` в фоне
- **Результат**: gap сокращается с 300мс до ~0мс

```typescript
// Псевдокод double-buffering
let activeRec: ISpeechRecognition | null = null;
let standbyRec: ISpeechRecognition | null = null;

function createStandby() {
  const rec = new SpeechRecognition();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = currentLang;
  // НЕ стартуем — просто готовим
  return rec;
}

function onActiveEnd() {
  if (standbyRec) {
    activeRec = standbyRec;
    activeRec.onresult = handleResult;
    activeRec.onend = onActiveEnd;
    activeRec.start();
    standbyRec = createStandby(); // готовим следующий
  }
}
```

**2b) Heartbeat / Keep-alive**
- Каждые 45 секунд проверять, жив ли SpeechRecognition
- Если `onend` не вызывался, но `onresult` не приходил >30сек — принудительно перезапустить
- Флаг `lastResultTimestamp` для отслеживания

**2c) Обработка всех ошибок с авто-рестартом**
```typescript
rec.onerror = (event) => {
  switch (event.error) {
    case "no-speech":      // Тишина — нормально, перезапускаем
    case "audio-capture":  // Микрофон глючнул — перезапускаем
    case "network":        // Сеть — перезапускаем с экспоненциальной задержкой
      scheduleRestart();
      break;
    case "not-allowed":    // Нет разрешения — показываем ошибку, не перезапускаем
      setError("Нет доступа к микрофону");
      break;
  }
};
```

---

### Шаг 3: Добавить троттлинг сокет-сообщений [$0]

**Файл**: `apps/web/src/hooks/useLiveSubtitles.ts`

Что сделать:
- Interim результаты отправлять **максимум 3 раза в секунду** (каждые 333мс)
- Final результаты отправлять **всегда сразу**
- Использовать простой троттлинг:

```typescript
const THROTTLE_MS = 333;
let lastEmitTime = 0;
let pendingInterim: string | null = null;
let throttleTimer: number | null = null;

function emitSubtitle(text: string, isFinal: boolean) {
  if (isFinal) {
    // Final — отправляем сразу
    if (throttleTimer) { clearTimeout(throttleTimer); throttleTimer = null; }
    socket.emit("subtitle_broadcast", { text, isFinal: true, lang: displayLang, ... });
    pendingInterim = null;
    return;
  }
  
  const now = Date.now();
  if (now - lastEmitTime >= THROTTLE_MS) {
    socket.emit("subtitle_broadcast", { text, isFinal: false, lang: displayLang, ... });
    lastEmitTime = now;
    pendingInterim = null;
  } else {
    // Сохраняем и отправим позже
    pendingInterim = text;
    if (!throttleTimer) {
      throttleTimer = setTimeout(() => {
        if (pendingInterim) {
          socket.emit("subtitle_broadcast", { text: pendingInterim, isFinal: false, lang: displayLang, ... });
          lastEmitTime = Date.now();
          pendingInterim = null;
        }
        throttleTimer = null;
      }, THROTTLE_MS);
    }
  }
}
```

**Результат**: вместо 5-10 сообщений/сек — максимум 3, при этом final всегда приходит без задержки.

---

### Шаг 4: Исправить поток языков и передавать язык в payload [$0]

**Файлы**: 
- `apps/web/src/hooks/useLiveSubtitles.ts`
- `apps/web/src/context/CallFeaturesContext.tsx`

Что сделать:

**4a) Передавать язык распознавания в broadcast**

Сейчас `lang` передаётся в `subtitle_broadcast`, но не заполняется корректно:
```typescript
// Текущий код (useLiveSubtitles.ts, onresult):
socketRef.current.emit("subtitle_broadcast", { 
  ...payload, 
  to: remoteUserIdRef.current 
});
// ← lang НЕ ПЕРЕДАЁТСЯ в payload!
```

Исправить:
```typescript
const payload = {
  text,
  speakerId: localSpeakerIdRef.current,
  username: localUsernameRef.current,
  isFinal,
  lang: displayLangRef.current, // ← язык на котором я говорю
};
```

**4b) На приёмной стороне — использовать `lang` для перевода**

```typescript
const onReceived = async (data) => {
  if (!shouldShowRef.current) return;
  
  const sourceLang = data.lang || speechLangRef.current;
  const targetLang = displayLangRef.current;
  
  let finalText = data.text;
  
  // Переводить только если языки разные
  if (toLangCode(sourceLang) !== toLangCode(targetLang)) {
    if (data.isFinal) {
      finalText = await translateText(data.text, sourceLang, targetLang);
    } else {
      // Interim — переводим с дебаунсом, или показываем оригинал
      finalText = await translateText(data.text, sourceLang, targetLang);
    }
  }
  
  upsertSubtitle(data.speakerId, data.username, finalText, data.isFinal);
};
```

---

### Шаг 5: Добавить настройки субтитров в UI звонка [$0]

**Файл**: `apps/web/src/components/CallOverlay.tsx`

Что сделать:
- Рядом с кнопкой CC добавить кнопку настроек (шестерёнка)
- По клику открывать `SubtitleSettingsPopup` (уже существует!)
- Связать `speechLang` / `displayLang` из `CallFeaturesContext`

Сейчас `SubtitleSettingsPopup` уже написан в `SubtitlesOverlay.tsx`, но **нигде не рендерится в CallOverlay**. Нужно:

```tsx
// В CallOverlayContent, рядом с CCButton:
const [showSubSettings, setShowSubSettings] = useState(false);

// В JSX:
<div style={{ position: "relative" }}>
  <CCButton active={subtitlesEnabled} onToggle={toggleSubtitles} />
  {subtitlesEnabled && (
    <button onClick={() => setShowSubSettings(!showSubSettings)} 
            title="Настройки субтитров" ...>
      ⚙️
    </button>
  )}
  {showSubSettings && (
    <SubtitleSettingsPopup
      speechLang={ctx.speechLang}
      displayLang={ctx.displayLang}
      onSpeechLangChange={ctx.setSpeechLang}
      onDisplayLangChange={ctx.setDisplayLang}
      onClose={() => setShowSubSettings(false)}
    />
  )}
</div>
```

---

### Шаг 6: Оптимизировать перевод interim-результатов [$0]

**Файл**: `apps/web/src/hooks/useTranslate.ts` + `useLiveSubtitles.ts`

Проблема: Google Translate free API имеет rate-limit. Если переводить каждый interim — будет ~3-5 запросов/сек, что может привести к блокировке.

Решение:
- **Interim**: переводить только каждый 2-3 interim (или по таймеру раз в 500мс)
- **Final**: переводить ВСЕГДА
- Использовать кэш (уже есть в `useTranslate.ts`, размер 500)
- Добавить retry с экспоненциальной задержкой при ошибке

```typescript
// В useLiveSubtitles.ts
const interimTranslateTimer = useRef<number | null>(null);
const lastInterimTranslation = useRef<string>("");

const onReceived = async (data) => {
  if (!shouldShowRef.current) return;
  
  const needsTranslation = toLangCode(data.lang || speechLangRef.current) 
                        !== toLangCode(displayLangRef.current);
  
  if (!needsTranslation) {
    upsertSubtitle(data.speakerId, data.username, data.text, data.isFinal);
    return;
  }
  
  if (data.isFinal) {
    // Final — всегда переводим
    const translated = await translateText(data.text, data.lang, displayLangRef.current);
    upsertSubtitle(data.speakerId, data.username, translated, true);
  } else {
    // Interim — показываем оригинал сразу, переводим с задержкой
    upsertSubtitle(data.speakerId, data.username, data.text, false);
    
    // Отложенный перевод interim (раз в 600мс)
    if (interimTranslateTimer.current) clearTimeout(interimTranslateTimer.current);
    interimTranslateTimer.current = window.setTimeout(async () => {
      const translated = await translateText(data.text, data.lang, displayLangRef.current);
      if (translated !== data.text) {
        upsertSubtitle(data.speakerId, data.username, translated, false);
      }
    }, 600);
  }
};
```

---

### Шаг 7: Добавить индикацию состояния и fallback [$0]

**Файлы**: `SubtitlesOverlay.tsx`, `useLiveSubtitles.ts`

Что сделать:

**7a) Индикация состояния распознавания**
- Показывать маленький индикатор: 🎙️ (слушаю) / ⚠️ (переподключение) / ❌ (не работает)
- Экспортировать `isListening` и `error` из хука (уже есть, но не используются в UI)

**7b) Fallback для неподдерживаемых браузеров**
- Firefox / Safari: показать сообщение "Субтитры доступны только в Chrome/Edge"
- Кнопка CC уже скрывается если нет поддержки — это ок

**7c) Показывать оригинал рядом с переводом** (опционально)
- Для final-субтитров: "Hello → Привет" 
- Или показывать оригинал мелким шрифтом под переводом

---

## Порядок реализации (от наибольшего эффекта)

| # | Шаг | Эффект | Сложность | Стоимость |
|---|------|--------|-----------|-----------|
| 1 | Подключить перевод (Шаг 1 + 4) | 🔴 Критический — без этого перевод не работает | Средняя | $0 |
| 2 | Стабилизировать WSA (Шаг 2) | 🔴 Критический — обрывы каждую минуту | Средняя | $0 |
| 3 | Троттлинг (Шаг 3) | 🟡 Важный — снижает нагрузку на сеть | Лёгкая | $0 |
| 4 | UI настроек (Шаг 5) | 🟡 Важный — пользователь не может выбрать язык | Лёгкая | $0 |
| 5 | Оптимизация перевода (Шаг 6) | 🟢 Улучшение — предотвращает rate-limit | Лёгкая | $0 |
| 6 | Индикация (Шаг 7) | 🟢 Улучшение — UX | Лёгкая | $0 |

**Итого: $0** — все улучшения бесплатные.

---

## Файлы, которые нужно изменить

```
apps/web/src/hooks/useLiveSubtitles.ts    — основная логика (Шаги 1-4, 6)
apps/web/src/hooks/useTranslate.ts         — мелкие улучшения (Шаг 6)
apps/web/src/components/SubtitlesOverlay.tsx — индикация (Шаг 7)
apps/web/src/components/CallOverlay.tsx     — кнопка настроек (Шаг 5)
apps/web/src/context/CallFeaturesContext.tsx — мелкие фиксы (Шаг 4)
```

Серверную часть (`apps/api/index.ts`) **менять не нужно** — сокет-relay уже передаёт `lang` в payload.

---

## Если захочешь платное решение (позже, не сейчас)

Единственное, что Web Speech API не может сделать хорошо:
- Работать в Firefox/Safari
- Работать стабильно >5 минут без единого обрыва
- Распознавать речь с высокой точностью в шумной обстановке

Для этого нужен **серверный STT**. Самые дешёвые варианты:

| Сервис | Цена | Качество | Стриминг |
|--------|------|----------|----------|
| Deepgram Nova-2 | $0.0043/мин (~$0.26/час) | Отличное | Да (WebSocket) |
| Google Cloud STT | $0.006/мин (~$0.36/час) | Отличное | Да (gRPC) |
| AssemblyAI | $0.0065/мин (~$0.39/час) | Очень хорошее | Да (WebSocket) |

**Но сейчас это НЕ НУЖНО** — исправления из плана выше сделают субтитры рабочими и стабильными на Web Speech API бесплатно.

---

## Инструкция для IDE

Вставь этот план в свою IDE и попроси:

> "Реализуй все 7 шагов из этого плана. Начни с Шага 1 (подключение перевода) и Шага 4 (передача языка). Затем Шаг 2 (стабилизация). Затем остальные шаги. Изменяй только файлы из списка выше."
