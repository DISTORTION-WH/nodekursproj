const fs = require("node:fs");
const path = require("node:path");
const pptxgen = require("pptxgenjs");

const ROOT = path.resolve(__dirname, "..", "..", "..");
const MEDIA = path.join(ROOT, ".codex_doc_work", "zapiska_media");
const OUT = process.env.PPTX_OUT || path.join(ROOT, "zapiska", "Lume_BGTU_defense.pptx");

const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "Шатерник Глеб";
pptx.company = "БГТУ";
pptx.subject = "Презентация для защиты дипломного проекта";
pptx.title = "Разработка веб-приложения Lume для видеозвонков и обмена сообщениями";
pptx.lang = "ru-RU";
pptx.theme = {
  headFontFace: "Arial",
  bodyFontFace: "Arial",
  lang: "ru-RU",
};
pptx.margin = 0;

const W = 13.333;
const H = 7.5;
const FONT = "Arial";
const BLACK = "111111";
const GRAY = "555555";
const MID = "9A9A9A";
const LIGHT = "E8E8E8";
const SOFT = "F4F4F4";
const WHITE = "FFFFFF";

function slideNumber(slide, n) {
  slide.addShape(pptx.ShapeType.line, {
    x: 0.55,
    y: 6.93,
    w: 12.25,
    h: 0,
    line: { color: LIGHT, width: 0.75 },
  });
  slide.addText(String(n).padStart(2, "0"), {
    x: 12.15,
    y: 6.98,
    w: 0.65,
    h: 0.2,
    fontFace: FONT,
    fontSize: 8.5,
    color: GRAY,
    align: "right",
    margin: 0,
  });
}

function addTitle(slide, title, subtitle) {
  slide.addText(title, {
    x: 0.72,
    y: 0.46,
    w: 11.9,
    h: 0.62,
    fontFace: FONT,
    fontSize: 27,
    bold: true,
    color: BLACK,
    margin: 0,
    fit: "shrink",
    breakLine: false,
  });
  slide.addShape(pptx.ShapeType.line, {
    x: 0.72,
    y: 1.21,
    w: 2.0,
    h: 0,
    line: { color: BLACK, width: 1.2 },
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.72,
      y: 1.36,
      w: 11.8,
      h: 0.34,
      fontFace: FONT,
      fontSize: 13.5,
      color: GRAY,
      margin: 0,
      fit: "shrink",
    });
  }
}

function addBullet(slide, text, x, y, w, fontSize = 18, h = 0.38) {
  slide.addText(`• ${text}`, {
    x,
    y,
    w,
    h,
    fontFace: FONT,
    fontSize,
    color: BLACK,
    margin: 0,
    breakLine: false,
    fit: "shrink",
  });
}

function addBullets(slide, items, x, y, w, opts = {}) {
  const fontSize = opts.fontSize || 18;
  const step = opts.step || 0.54;
  const h = opts.h || 0.42;
  items.forEach((item, idx) => addBullet(slide, item, x, y + idx * step, w, fontSize, h));
}

function addKicker(slide, text, x, y, w) {
  slide.addText(text.toUpperCase(), {
    x,
    y,
    w,
    h: 0.24,
    fontFace: FONT,
    fontSize: 8.5,
    bold: true,
    color: GRAY,
    margin: 0,
    fit: "shrink",
    breakLine: false,
  });
}

function addCaption(slide, text, x, y, w) {
  slide.addText(text, {
    x,
    y,
    w,
    h: 0.22,
    fontFace: FONT,
    fontSize: 8.8,
    color: GRAY,
    margin: 0,
    align: "center",
    fit: "shrink",
  });
}

function addNotes(slide, text) {
  slide.addNotes(text.replace(/\n{3,}/g, "\n\n"));
}

function pngSize(file) {
  const b = fs.readFileSync(file);
  if (b.length > 24 && b.toString("ascii", 1, 4) === "PNG") {
    return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  }
  throw new Error(`Unsupported image format: ${file}`);
}

function addImageContain(slide, file, x, y, w, h, opts = {}) {
  const { width, height } = pngSize(file);
  const scale = Math.min(w / width, h / height);
  const iw = width * scale;
  const ih = height * scale;
  const ix = x + (w - iw) / 2;
  const iy = y + (h - ih) / 2;
  if (opts.frame !== false) {
    slide.addShape(pptx.ShapeType.rect, {
      x,
      y,
      w,
      h,
      fill: { color: WHITE, transparency: 100 },
      line: { color: LIGHT, width: 0.8 },
    });
  }
  slide.addImage({ path: file, x: ix, y: iy, w: iw, h: ih });
}

function media(name) {
  const file = path.join(MEDIA, name);
  if (!fs.existsSync(file)) throw new Error(`Missing media file: ${file}`);
  return file;
}

function rectText(slide, text, x, y, w, h, opts = {}) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.03,
    fill: { color: opts.fill || WHITE, transparency: opts.transparency ?? 100 },
    line: { color: opts.line || LIGHT, width: opts.lineWidth || 0.8 },
  });
  slide.addText(text, {
    x: x + 0.14,
    y: y + 0.12,
    w: w - 0.28,
    h: h - 0.2,
    fontFace: FONT,
    fontSize: opts.fontSize || 14,
    bold: opts.bold || false,
    color: opts.color || BLACK,
    margin: 0,
    valign: "mid",
    fit: "shrink",
  });
}

function addMetric(slide, value, label, x, y, w) {
  slide.addText(value, {
    x,
    y,
    w,
    h: 0.5,
    fontFace: FONT,
    fontSize: 31,
    bold: true,
    color: BLACK,
    margin: 0,
    fit: "shrink",
  });
  slide.addText(label, {
    x,
    y: y + 0.55,
    w,
    h: 0.36,
    fontFace: FONT,
    fontSize: 11.5,
    color: GRAY,
    margin: 0,
    fit: "shrink",
  });
}

function arrow(slide, x1, y1, x2, y2) {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);
  slide.addShape(pptx.ShapeType.line, {
    x,
    y,
    w,
    h,
    line: { color: BLACK, width: 1.1 },
  });
  if (w > h) {
    slide.addText(">", {
      x: (x1 + x2) / 2 - 0.08,
      y: (y1 + y2) / 2 - 0.12,
      w: 0.2,
      h: 0.2,
      fontFace: FONT,
      fontSize: 10,
      bold: true,
      color: BLACK,
      margin: 0,
    });
  } else if (h > 0) {
    slide.addText("v", {
      x: (x1 + x2) / 2 - 0.05,
      y: (y1 + y2) / 2 - 0.1,
      w: 0.2,
      h: 0.2,
      fontFace: FONT,
      fontSize: 9,
      bold: true,
      color: BLACK,
      margin: 0,
    });
  }
}

function addTable(slide, rows, x, y, w, h, colW) {
  const widths = colW || rows[0].map(() => w / rows[0].length);
  const rowH = h / rows.length;
  slide.addShape(pptx.ShapeType.rect, {
    x,
    y,
    w,
    h,
    fill: { color: WHITE, transparency: 100 },
    line: { color: "D0D0D0", width: 0.6 },
  });
  rows.forEach((rowData, rowIdx) => {
    let cx = x;
    if (rowIdx === 0) {
      slide.addShape(pptx.ShapeType.rect, {
        x,
        y: y + rowIdx * rowH,
        w,
        h: rowH,
        fill: { color: SOFT },
        line: { color: SOFT, transparency: 100 },
      });
    }
    rowData.forEach((cell, colIdx) => {
      const value = typeof cell === "object" && cell !== null ? cell.text : cell;
      const options = typeof cell === "object" && cell !== null ? cell.options || {} : {};
      slide.addText(String(value), {
        x: cx + 0.08,
        y: y + rowIdx * rowH + 0.07,
        w: widths[colIdx] - 0.16,
        h: rowH - 0.12,
        fontFace: FONT,
        fontSize: options.fontSize || (rowIdx === 0 ? 11.4 : 10.8),
        bold: options.bold || rowIdx === 0,
        color: options.color || BLACK,
        margin: 0,
        valign: "mid",
        fit: "shrink",
      });
      cx += widths[colIdx];
      if (colIdx < rowData.length - 1) {
        slide.addShape(pptx.ShapeType.line, {
          x: cx,
          y,
          w: 0,
          h,
          line: { color: "D0D0D0", width: 0.6 },
        });
      }
    });
    if (rowIdx < rows.length - 1) {
      slide.addShape(pptx.ShapeType.line, {
        x,
        y: y + (rowIdx + 1) * rowH,
        w,
        h: 0,
        line: { color: "D0D0D0", width: 0.6 },
      });
    }
  });
}

function cover() {
  const slide = pptx.addSlide();
  slide.background = { color: WHITE };
  slide.addText("БГТУ | дипломный проект | 2026", {
    x: 0.72,
    y: 0.46,
    w: 4.4,
    h: 0.25,
    fontFace: FONT,
    fontSize: 10.5,
    color: GRAY,
    margin: 0,
    fit: "shrink",
  });
  slide.addShape(pptx.ShapeType.line, {
    x: 0.72,
    y: 1.08,
    w: 2.4,
    h: 0,
    line: { color: BLACK, width: 1.2 },
  });
  slide.addText("Разработка веб-приложения\n«Lume» для видеозвонков\nи обмена сообщениями", {
    x: 0.72,
    y: 1.42,
    w: 10.9,
    h: 2.55,
    fontFace: FONT,
    fontSize: 35,
    bold: true,
    color: BLACK,
    margin: 0,
    fit: "shrink",
    breakLine: false,
  });
  slide.addText("React + TypeScript / Node.js + Express / PostgreSQL / Socket.IO / WebRTC", {
    x: 0.76,
    y: 4.26,
    w: 9.4,
    h: 0.34,
    fontFace: FONT,
    fontSize: 13.5,
    color: GRAY,
    margin: 0,
    fit: "shrink",
  });
  slide.addText("Студент: Шатерник Глеб\nФормат доклада: 8 минут", {
    x: 0.76,
    y: 6.0,
    w: 4.7,
    h: 0.58,
    fontFace: FONT,
    fontSize: 13,
    color: BLACK,
    margin: 0,
    breakLine: false,
  });
  slide.addText("LUME", {
    x: 10.65,
    y: 5.83,
    w: 1.85,
    h: 0.42,
    fontFace: FONT,
    fontSize: 20,
    bold: true,
    color: BLACK,
    align: "right",
    margin: 0,
  });
  slide.addShape(pptx.ShapeType.line, {
    x: 9.35,
    y: 6.42,
    w: 3.15,
    h: 0,
    line: { color: BLACK, width: 1.1 },
  });
  addNotes(slide, `Время: 0:00-0:30.
Уважаемые члены комиссии, тема моего дипломного проекта - разработка веб-приложения Lume для видеозвонков и обмена сообщениями. В докладе я кратко покажу актуальность задачи, архитектуру, основные функции, результаты тестирования и экономическое обоснование проекта.`);
}

function relevance() {
  const slide = pptx.addSlide();
  slide.background = { color: WHITE };
  addTitle(slide, "Актуальность и цель", "Проект решает задачу единой управляемой среды цифрового общения");
  slide.addText("Почему это важно", {
    x: 0.78,
    y: 2.06,
    w: 4.2,
    h: 0.42,
    fontFace: FONT,
    fontSize: 27,
    bold: true,
    color: BLACK,
    margin: 0,
    fit: "shrink",
  });
  addBullets(slide, [
    "цифровая коммуникация требует переписки, звонков и обмена файлами в одном окне",
    "сторонние платформы ограничивают контроль над данными, ролями и правилами доступа",
    "для учебных групп, команд и сообществ важны простота, безопасность и управляемость",
  ], 0.82, 2.9, 6.2, { fontSize: 17, step: 0.72, h: 0.55 });
  slide.addShape(pptx.ShapeType.line, {
    x: 7.15,
    y: 2.0,
    w: 0,
    h: 3.8,
    line: { color: LIGHT, width: 1.0 },
  });
  addKicker(slide, "Цель разработки", 7.55, 2.08, 4.5);
  slide.addText("Разработать веб-приложение «Lume» для личного и группового общения пользователей с поддержкой сообщений, файлов, голосовых и видеозвонков, системы друзей, персонализации профиля, модерации и администрирования.", {
    x: 7.55,
    y: 2.43,
    w: 4.85,
    h: 1.75,
    fontFace: FONT,
    fontSize: 18,
    color: BLACK,
    margin: 0,
    fit: "shrink",
  });
  ["сообщения", "файлы", "звонки", "модерация"].forEach((t, i) => {
    rectText(slide, t, 7.56 + i * 1.2, 4.85, 1.02, 0.42, { fontSize: 10.7, line: "CFCFCF" });
  });
  slideNumber(slide, 2);
  addNotes(slide, `Время: 0:30-1:10.
Актуальность проекта связана с тем, что пользователям нужна единая среда для коммуникации: не только сообщения, но и файлы, звонки, управление доступом и модерация. Целью работы стала разработка веб-приложения Lume, которое объединяет эти сценарии в браузере и может применяться индивидуальными пользователями, учебными группами и небольшими командами.`);
}

function tasks() {
  const slide = pptx.addSlide();
  slide.background = { color: WHITE };
  addTitle(slide, "Задачи дипломного проекта", "Работа охватила полный цикл: от анализа аналогов до экономического обоснования");
  const tasks = [
    ["1", "Проанализировать аналоги: Zoom, Discord, Google Meet"],
    ["2", "Сформировать требования и спроектировать архитектуру приложения"],
    ["3", "Разработать структуру базы данных и пользовательский интерфейс"],
    ["4", "Реализовать клиентскую и серверную части"],
    ["5", "Проверить работоспособность ключевых функций"],
    ["6", "Подготовить руководство пользователя и экономический расчет"],
  ];
  tasks.forEach(([n, text], i) => {
    const y = 1.95 + i * 0.72;
    slide.addText(n, {
      x: 0.82,
      y,
      w: 0.36,
      h: 0.32,
      fontFace: FONT,
      fontSize: 17,
      bold: true,
      color: BLACK,
      margin: 0,
      align: "center",
      fit: "shrink",
    });
    slide.addShape(pptx.ShapeType.line, {
      x: 1.35,
      y: y + 0.18,
      w: 0.52,
      h: 0,
      line: { color: MID, width: 0.8 },
    });
    slide.addText(text, {
      x: 2.05,
      y: y - 0.02,
      w: 9.8,
      h: 0.4,
      fontFace: FONT,
      fontSize: 18,
      color: BLACK,
      margin: 0,
      fit: "shrink",
    });
  });
  slideNumber(slide, 3);
  addNotes(slide, `Время: 1:10-1:45.
Для достижения цели были поставлены шесть задач. Сначала я изучил существующие решения, затем спроектировал требования, архитектуру, базу данных и интерфейс. После этого были реализованы клиентская и серверная части, выполнено тестирование, подготовлено руководство пользователя и рассчитаны экономические показатели.`);
}

function analogs() {
  const slide = pptx.addSlide();
  slide.background = { color: WHITE };
  addTitle(slide, "Анализ аналогов", "Из сравнения выделены функции, которые должны быть объединены в Lume");
  const rows = [
    [
      { text: "Аналог", options: { bold: true, fill: SOFT } },
      { text: "Сильная сторона", options: { bold: true, fill: SOFT } },
      { text: "Ограничение для проекта", options: { bold: true, fill: SOFT } },
    ],
    ["Zoom", "стабильные видеоконференции", "нет постоянного контекста чатов и системы друзей"],
    ["Discord", "сообщества, каналы, голосовая связь", "избыточная сложность и зависимость от внешней платформы"],
    ["Google Meet", "быстрый вход во встречу", "фокус на сессии, а не на постоянной коммуникации"],
  ];
  addTable(slide, rows, 0.78, 1.98, 11.8, 2.35, [1.55, 4.0, 6.25]);
  slide.addText("Вывод для разработки", {
    x: 0.8,
    y: 4.85,
    w: 4.4,
    h: 0.38,
    fontFace: FONT,
    fontSize: 23,
    bold: true,
    color: BLACK,
    margin: 0,
    fit: "shrink",
  });
  addBullets(slide, [
    "объединить переписку, видеосвязь, друзей и роли в одном веб-приложении",
    "оставить интерфейс проще корпоративных платформ",
    "сделать модерацию и администрирование частью основной системы",
  ], 0.86, 5.4, 10.8, { fontSize: 16.5, step: 0.43, h: 0.34 });
  slideNumber(slide, 4);
  addNotes(slide, `Время: 1:45-2:25.
В аналитическом разделе были рассмотрены Zoom, Discord и Google Meet. Zoom силен в видеоконференциях, но не закрывает постоянные чаты и социальную модель. Discord лучше подходит для сообществ, но сложен и остается внешней платформой. Google Meet удобен для встреч, но не решает задачу постоянного обмена сообщениями. Поэтому Lume строился как объединение сообщений, звонков, друзей, ролей и модерации в одном веб-приложении.`);
}

function functionality() {
  const slide = pptx.addSlide();
  slide.background = { color: WHITE };
  addTitle(slide, "Функциональные возможности", "Система поддерживает сценарии гостя, пользователя, модератора и администратора");
  addKicker(slide, "Пользователь", 0.82, 1.9, 3.5);
  addBullets(slide, [
    "регистрация, email-подтверждение, восстановление пароля",
    "профиль, аватар, оформление и список друзей",
    "личные и групповые чаты",
  ], 0.85, 2.28, 5.25, { fontSize: 15.7, step: 0.5, h: 0.4 });
  addKicker(slide, "Коммуникация", 6.9, 1.9, 3.5);
  addBullets(slide, [
    "сообщения, ответы, пересылка, удаление и закрепление",
    "файлы, стикеры, реакции, опросы и отложенные сообщения",
    "голосовые и видеозвонки",
  ], 6.92, 2.28, 5.35, { fontSize: 15.7, step: 0.5, h: 0.4 });
  slide.addShape(pptx.ShapeType.line, {
    x: 0.82,
    y: 4.45,
    w: 11.6,
    h: 0,
    line: { color: LIGHT, width: 0.9 },
  });
  addKicker(slide, "Управление и контроль", 0.82, 4.85, 4.6);
  addBullets(slide, [
    "ролевые права внутри чатов: member, trusted, moderator, owner",
    "жалобы, предупреждения, блокировки, журналы событий",
    "админ-панель для пользователей, чатов, рассылок и статистики",
  ], 0.85, 5.23, 11.1, { fontSize: 15.7, step: 0.48, h: 0.4 });
  slideNumber(slide, 5);
  addNotes(slide, `Время: 2:25-3:05.
Функционально приложение закрывает основные сценарии коммуникации. Пользователь может зарегистрироваться, подтвердить email, настроить профиль, добавить друзей, вести личные и групповые чаты. В сообщениях реализованы ответы, пересылка, реакции, стикеры, файлы, опросы и отложенная отправка. Для контроля порядка предусмотрены роли внутри чатов, жалобы, предупреждения, блокировки, журналы событий и административная панель.`);
}

function architecture() {
  const slide = pptx.addSlide();
  slide.background = { color: WHITE };
  addTitle(slide, "Архитектура решения", "Клиент, API, база данных, хранилище и сервисы реального времени разделены по ответственности");
  const y = 2.05;
  rectText(slide, "Клиент\nReact 19 + TypeScript", 0.85, y, 2.15, 0.78, { fontSize: 13.5, bold: true, line: "BDBDBD" });
  rectText(slide, "API\nNode.js + Express", 4.05, y, 2.15, 0.78, { fontSize: 13.5, bold: true, line: "BDBDBD" });
  rectText(slide, "PostgreSQL\n22 таблицы", 7.18, y - 0.62, 2.2, 0.72, { fontSize: 13.2, bold: true, line: "BDBDBD" });
  rectText(slide, "MinIO\nмедиафайлы", 7.18, y + 0.62, 2.2, 0.72, { fontSize: 13.2, bold: true, line: "BDBDBD" });
  rectText(slide, "Socket.IO\nсобытия чатов", 4.05, 3.65, 2.15, 0.72, { fontSize: 13.2, bold: true, line: "BDBDBD" });
  rectText(slide, "WebRTC / mediasoup\nзвонки", 7.18, 3.65, 2.2, 0.72, { fontSize: 13.2, bold: true, line: "BDBDBD" });
  rectText(slide, "Docker + Nginx\nразвертывание", 10.15, 2.55, 2.15, 0.72, { fontSize: 13.2, bold: true, line: "BDBDBD" });
  arrow(slide, 3.05, y + 0.39, 3.95, y + 0.39);
  arrow(slide, 6.25, y + 0.18, 7.05, y - 0.15);
  arrow(slide, 6.25, y + 0.56, 7.05, y + 0.86);
  arrow(slide, 5.1, 2.88, 5.1, 3.53);
  arrow(slide, 6.25, 4.0, 7.05, 4.0);
  arrow(slide, 9.5, 3.0, 10.05, 3.0);
  slide.addText("Routes → Controllers → Services", {
    x: 0.88,
    y: 5.25,
    w: 4.1,
    h: 0.34,
    fontFace: FONT,
    fontSize: 18,
    bold: true,
    color: BLACK,
    margin: 0,
  });
  addBullets(slide, [
    "REST API обслуживает бизнес-операции и проверку доступа",
    "Socket.IO доставляет сообщения, реакции и системные события без опроса сервера",
    "Docker Compose обеспечивает воспроизводимое окружение",
  ], 0.9, 5.82, 11.2, { fontSize: 14.7, step: 0.36, h: 0.3 });
  slideNumber(slide, 6);
  addNotes(slide, `Время: 3:05-3:55.
Архитектура разделена на клиентскую часть, серверный API, базу данных, объектное хранилище и сервисы реального времени. Клиент написан на React и TypeScript. Серверная часть использует Node.js и Express, а внутри разделена на маршруты, контроллеры и сервисы. PostgreSQL хранит основные данные, MinIO вынесен для медиафайлов. Socket.IO отвечает за события чатов, WebRTC и mediasoup - за звонки. Для развертывания подготовлены Docker, Docker Compose и Nginx.`);
}

function dataSecurity() {
  const slide = pptx.addSlide();
  slide.background = { color: WHITE };
  addTitle(slide, "Данные и безопасность", "Модель данных поддерживает коммуникацию, роли, модерацию и служебные процессы");
  addMetric(slide, "22", "таблицы PostgreSQL связаны внешними ключами", 0.85, 2.05, 2.1);
  addMetric(slide, "4", "логические группы данных", 3.35, 2.05, 2.3);
  slide.addShape(pptx.ShapeType.line, {
    x: 0.82,
    y: 3.35,
    w: 5.2,
    h: 0,
    line: { color: LIGHT, width: 0.9 },
  });
  addBullets(slide, [
    "основные сущности: users, profiles, roles, chats, friends",
    "коммуникация: messages, reactions, mentions, reads, polls",
    "модерация: reports, warnings, bans",
    "служебные таблицы: коды регистрации, сброс пароля, app_logs",
  ], 0.85, 3.78, 5.65, { fontSize: 14.5, step: 0.42, h: 0.32 });
  addKicker(slide, "Механизмы защиты", 7.05, 2.05, 4.0);
  addBullets(slide, [
    "JWT access/refresh токены для HTTP и Socket.IO",
    "bcryptjs для хеширования паролей",
    "проверка ролей по актуальным данным БД",
    "email-коды регистрации и восстановления доступа",
    "валидация входных данных на уровне API и клиента",
  ], 7.08, 2.48, 5.2, { fontSize: 15.2, step: 0.5, h: 0.4 });
  slideNumber(slide, 7);
  addNotes(slide, `Время: 3:55-4:35.
База данных включает 22 таблицы, объединенные внешними ключами. Их можно разделить на четыре группы: основные таблицы пользователей, ролей, чатов и друзей; таблицы коммуникации; таблицы модерации; служебные таблицы для кодов подтверждения и журналов. Безопасность обеспечивается JWT-токенами, хешированием паролей через bcryptjs, проверкой ролей по актуальным данным базы, email-подтверждением и валидацией входных данных.`);
}

function realtime() {
  const slide = pptx.addSlide();
  slide.background = { color: WHITE };
  addTitle(slide, "Реальное время и видеосвязь", "Критичные пользовательские действия выполняются без перезагрузки страницы");
  addKicker(slide, "Отправка сообщения", 0.82, 1.95, 4.0);
  const steps = ["JWT", "проверка прав", "запись в БД", "Socket.IO room", "обновление UI"];
  steps.forEach((t, i) => {
    rectText(slide, t, 0.85 + i * 2.1, 2.42, 1.55, 0.52, { fontSize: 12.2, bold: i === 0 || i === 4, line: "BDBDBD" });
    if (i < steps.length - 1) arrow(slide, 2.43 + i * 2.1, 2.68, 2.87 + i * 2.1, 2.68);
  });
  addBullets(slide, [
    "сервер сохраняет сообщение и рассылает событие только участникам chat_id",
    "реакции, удаления и системные уведомления синхронизируются тем же каналом",
  ], 0.9, 3.48, 11.2, { fontSize: 15.2, step: 0.42, h: 0.32 });
  slide.addShape(pptx.ShapeType.line, {
    x: 0.82,
    y: 4.45,
    w: 11.65,
    h: 0,
    line: { color: LIGHT, width: 0.9 },
  });
  addKicker(slide, "Оптимизация видеозвонка", 0.82, 4.78, 4.4);
  addBullets(slide, [
    "сбор RTT, джиттера, потери пакетов и пропускной способности",
    "прогноз деградации сети на 2 секунды вперед",
    "при риске сбоя битрейт снижается до 500 кбит/с, затем плавно восстанавливается",
  ], 0.9, 5.16, 11.0, { fontSize: 15.2, step: 0.42, h: 0.32 });
  slideNumber(slide, 8);
  addNotes(slide, `Время: 4:35-5:15.
Для обмена сообщениями используется событийная модель Socket.IO. При отправке сообщения сервер проверяет токен и права пользователя, сохраняет запись в PostgreSQL и рассылает событие только участникам нужной комнаты. Для видеосвязи реализована логика мониторинга качества соединения: анализируются RTT, джиттер, потери пакетов и пропускная способность. При прогнозируемой деградации битрейт снижается, а после стабилизации плавно восстанавливается.`);
}

function interfaceSlide() {
  const slide = pptx.addSlide();
  slide.background = { color: WHITE };
  addTitle(slide, "Интерфейс пользователя", "Основной экран объединяет навигацию, переписку, медиа и управление профилем");
  addImageContain(slide, media("image29.png"), 0.78, 1.9, 5.65, 2.55);
  addCaption(slide, "Главная рабочая область и чат", 0.78, 4.55, 5.65);
  addImageContain(slide, media("image42.png"), 6.85, 1.9, 2.5, 2.55);
  addCaption(slide, "Медиа и видеосценарии", 6.85, 4.55, 2.5);
  addImageContain(slide, media("image46.png"), 9.75, 1.9, 2.5, 2.55);
  addCaption(slide, "Настройка профиля", 9.75, 4.55, 2.5);
  addBullets(slide, [
    "слева: чаты, друзья, входящие заявки и поиск пользователей",
    "в центре: переписка, вложения, реакции, стикеры и действия над сообщениями",
    "в профиле: аватар, фон, цвета, бейджи и смена пароля",
  ], 0.85, 5.35, 11.2, { fontSize: 14.8, step: 0.38, h: 0.3 });
  slideNumber(slide, 9);
  addNotes(slide, `Время: 5:15-5:55.
На слайде показан пользовательский интерфейс. После входа пользователь видит рабочую область с навигацией по чатам и друзьям, область переписки и панель действий. Через интерфейс можно отправлять сообщения, файлы, реакции, стикеры, работать с медиа и управлять профилем. Отдельное внимание уделено персонализации профиля, чтобы пользователь мог настроить внешний вид и данные аккаунта.`);
}

function adminSlide() {
  const slide = pptx.addSlide();
  slide.background = { color: WHITE };
  addTitle(slide, "Модерация и администрирование", "Ролевой контроль встроен в бизнес-логику сервера и пользовательский интерфейс");
  addImageContain(slide, media("image48.png"), 0.78, 1.9, 3.7, 1.6);
  addImageContain(slide, media("image50.png"), 4.85, 1.9, 3.7, 1.6);
  addImageContain(slide, media("image53.png"), 8.92, 1.9, 3.7, 1.6);
  addCaption(slide, "Панель модератора", 0.78, 3.6, 3.7);
  addCaption(slide, "Управление пользователями", 4.85, 3.6, 3.7);
  addCaption(slide, "Статистика приложения", 8.92, 3.6, 3.7);
  addKicker(slide, "Роли", 0.82, 4.55, 1.4);
  addBullets(slide, [
    "гость: регистрация и вход",
    "пользователь: чаты, друзья, профиль, звонки",
    "модератор: жалобы, предупреждения, блокировки",
    "администратор: пользователи, чаты, рассылки, статистика, логи",
  ], 0.85, 4.94, 5.8, { fontSize: 14.5, step: 0.36, h: 0.3 });
  addKicker(slide, "Ключевой принцип", 7.05, 4.55, 3.2);
  slide.addText("Права доступа проверяются на сервере при каждом запросе. Это исключает обход ограничений через устаревший токен или подмену состояния на клиенте.", {
    x: 7.08,
    y: 4.95,
    w: 5.2,
    h: 0.94,
    fontFace: FONT,
    fontSize: 15.2,
    color: BLACK,
    margin: 0,
    fit: "shrink",
  });
  slideNumber(slide, 10);
  addNotes(slide, `Время: 5:55-6:30.
В системе предусмотрены четыре роли: гость, пользователь, модератор и администратор. Модератор обрабатывает жалобы, выдает предупреждения и блокирует нарушителей. Администратор дополнительно управляет пользователями, чатами, рассылками, статистикой и логами. Важный момент - права проверяются на сервере по актуальным данным базы, поэтому клиент не может самостоятельно повысить привилегии.`);
}

function testingSlide() {
  const slide = pptx.addSlide();
  slide.background = { color: WHITE };
  addTitle(slide, "Тестирование", "Проверены стандартные, граничные и ошибочные сценарии работы приложения");
  slide.addText("41", {
    x: 0.85,
    y: 2.0,
    w: 2.0,
    h: 0.72,
    fontFace: FONT,
    fontSize: 48,
    bold: true,
    color: BLACK,
    margin: 0,
  });
  slide.addText("функциональный тест\nпройден успешно", {
    x: 0.92,
    y: 2.8,
    w: 3.0,
    h: 0.56,
    fontFace: FONT,
    fontSize: 15,
    color: GRAY,
    margin: 0,
    breakLine: false,
  });
  const rows = [
    ["Регистрация и вход", "email-код, пароль, блокировка, ошибки авторизации"],
    ["Сообщения и чаты", "доставка через Socket.IO, роли участников, приглашения"],
    ["Файлы и валидация", "лимит 5 МБ, формат email, длины полей, пустые значения"],
    ["Администрирование", "защита /admin/* и /moderator/*, запрет эскалации прав"],
    ["Связь", "WebRTC-звонки, восстановление Socket.IO при нестабильной сети"],
  ];
  rows.forEach(([left, right], i) => {
    const y = 1.92 + i * 0.74;
    slide.addText(left, {
      x: 4.25,
      y,
      w: 2.45,
      h: 0.32,
      fontFace: FONT,
      fontSize: 15.5,
      bold: true,
      color: BLACK,
      margin: 0,
      fit: "shrink",
    });
    slide.addText(right, {
      x: 6.95,
      y,
      w: 5.25,
      h: 0.32,
      fontFace: FONT,
      fontSize: 14.2,
      color: BLACK,
      margin: 0,
      fit: "shrink",
    });
    slide.addShape(pptx.ShapeType.line, {
      x: 4.25,
      y: y + 0.48,
      w: 8.05,
      h: 0,
      line: { color: LIGHT, width: 0.65 },
    });
  });
  slide.addText("Результат: система корректно обрабатывает ошибки и сохраняет работоспособность в ключевых сценариях.", {
    x: 0.86,
    y: 5.65,
    w: 11.2,
    h: 0.44,
    fontFace: FONT,
    fontSize: 17.2,
    bold: true,
    color: BLACK,
    margin: 0,
    fit: "shrink",
  });
  slideNumber(slide, 11);
  addNotes(slide, `Время: 6:30-7:10.
Для проверки были выполнены негативные и функциональные тесты. Негативное тестирование включало ошибки входа, регистрации, создания чата, отправки сообщений, загрузки файлов и доступа к административным маршрутам. Всего проведен 41 функциональный тест. Проверки подтвердили корректную работу регистрации, авторизации, сообщений, ролей, WebRTC-звонков и механизмов восстановления соединения.`);
}

function economySlide() {
  const slide = pptx.addSlide();
  slide.background = { color: WHITE };
  addTitle(slide, "Технико-экономическое обоснование", "Расчет показывает экономическую целесообразность продажи веб-приложения заказчику");
  const data = [
    ["Показатель", "Значение"],
    ["Полная себестоимость разработки", "18 146,60 руб."],
    ["Минимальная рыночная оценка аналога", "26 526,50 руб."],
    ["Средняя рыночная цена аналогов", "32 091,75 руб."],
    ["Цена продажи с НДС", "28 308,70 руб."],
    ["Прибыль от реализации", "5 443,98 руб."],
    ["Рентабельность продукта", "30,00%"],
    ["Чистая прибыль", "4 355,18 руб."],
  ];
  const rows = data.map((r, idx) => r.map((text) => ({
    text,
    options: {
      bold: idx === 0,
      fill: idx === 0 ? SOFT : WHITE,
      color: BLACK,
      fontFace: FONT,
      fontSize: idx === 0 ? 11.5 : 10.8,
    },
  })));
  addTable(slide, rows, 0.78, 1.88, 5.85, 3.65, [3.95, 1.9]);
  const bars = [
    ["Себестоимость", 18146.6],
    ["Минимум рынка", 26526.5],
    ["Цена продажи", 28308.7],
    ["Средняя цена", 32091.75],
  ];
  const max = 33000;
  bars.forEach(([label, value], i) => {
    const y = 2.08 + i * 0.72;
    slide.addText(label, {
      x: 7.05,
      y,
      w: 2.0,
      h: 0.26,
      fontFace: FONT,
      fontSize: 11.8,
      color: BLACK,
      margin: 0,
      fit: "shrink",
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 9.0,
      y: y + 0.04,
      w: 2.85,
      h: 0.16,
      fill: { color: "E1E1E1" },
      line: { color: "E1E1E1" },
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 9.0,
      y: y + 0.04,
      w: 2.85 * (value / max),
      h: 0.16,
      fill: { color: BLACK },
      line: { color: BLACK },
    });
    slide.addText(`${value.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} руб.`, {
      x: 11.95,
      y: y - 0.02,
      w: 0.95,
      h: 0.26,
      fontFace: FONT,
      fontSize: 8.8,
      color: GRAY,
      margin: 0,
      fit: "shrink",
    });
  });
  slide.addText("Вывод: цена реализации превышает себестоимость, а прибыль, рентабельность и чистая прибыль имеют положительные значения.", {
    x: 7.05,
    y: 5.35,
    w: 5.45,
    h: 0.72,
    fontFace: FONT,
    fontSize: 15.4,
    bold: true,
    color: BLACK,
    margin: 0,
    fit: "shrink",
  });
  slideNumber(slide, 12);
  addNotes(slide, `Время: 7:10-7:55.
В экономическом разделе рассчитана полная себестоимость разработки и первичного сопровождения - 18 146 рублей 60 копеек. Анализ аналогичных проектов показал минимальную рыночную оценку 26 526 рублей 50 копеек и среднюю цену 32 091 рубль 75 копеек. Цена продажи с НДС принята 28 308 рублей 70 копеек. Прибыль составляет 5 443 рубля 98 копеек, рентабельность - 30 процентов, чистая прибыль - 4 355 рублей 18 копеек. Это подтверждает экономическую целесообразность проекта.`);
}

function conclusionSlide() {
  const slide = pptx.addSlide();
  slide.background = { color: WHITE };
  addTitle(slide, "Выводы", "Цель дипломного проекта достигнута");
  addBullets(slide, [
    "проведен анализ предметной области и аналогичных решений",
    "спроектированы архитектура, база данных, роли и основные алгоритмы",
    "реализовано веб-приложение с чатами, друзьями, звонками, модерацией и администрированием",
    "выполнено тестирование ключевых и ошибочных сценариев",
    "экономический расчет подтверждает целесообразность разработки",
  ], 0.85, 1.95, 11.3, { fontSize: 18, step: 0.56, h: 0.43 });
  slide.addText("Спасибо за внимание", {
    x: 0.82,
    y: 5.75,
    w: 8.5,
    h: 0.58,
    fontFace: FONT,
    fontSize: 32,
    bold: true,
    color: BLACK,
    margin: 0,
    fit: "shrink",
  });
  slide.addText("Готов ответить на вопросы комиссии", {
    x: 0.84,
    y: 6.35,
    w: 6.0,
    h: 0.3,
    fontFace: FONT,
    fontSize: 14,
    color: GRAY,
    margin: 0,
  });
  slideNumber(slide, 13);
  addNotes(slide, `Время: 7:55-8:15.
В результате работы цель дипломного проекта достигнута: разработано веб-приложение Lume для видеозвонков и обмена сообщениями. Были выполнены анализ, проектирование, реализация, тестирование, руководство пользователя и экономическое обоснование. Проект может использоваться как основа для дальнейшего развития коммуникационной платформы. Спасибо за внимание, готов ответить на вопросы.`);
}

async function main() {
  const builders = [
    cover,
    relevance,
    tasks,
    analogs,
    functionality,
    architecture,
    dataSecurity,
    realtime,
    interfaceSlide,
    adminSlide,
    testingSlide,
    economySlide,
    conclusionSlide,
  ];
  const limit = process.env.SLIDE_LIMIT ? Number(process.env.SLIDE_LIMIT) : builders.length;
  builders.slice(0, limit).forEach((build) => build());

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await pptx.writeFile({ fileName: OUT });
  console.log(OUT);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
