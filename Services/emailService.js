// 1. Используем CommonJS (require) вместо import, т.к. ваш проект на CJS
const { Resend } = require("resend");

// 2. Получаем ключ из переменных окружения (которые вы задали на Render)
const RESEND_API_KEY = process.env.RESEND_API_KEY;

let resend;
if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
} else {
  console.error(
    "!!! ВНИМАНИЕ: RESEND_API_KEY не установлен в переменных окружения."
  );
  console.error(
    "!!! Добавьте RESEND_API_KEY в .env (локально) или в Environment на Render."
  );
}

/**
 * Отправляет email с кодом подтверждения через Resend.
 * @param {string} to - Email получателя
 * @param {string} code - 6-значный код
 */
async function sendVerificationEmail(to, code) {
  // Если ключ не был найден при старте, resend не будет создан.
  if (!resend) {
    console.error(
      "Ошибка отправки: Resend не инициализирован. Проверьте RESEND_API_KEY."
    );
    // Бросаем ошибку, чтобы authController ее поймал
    throw new Error("Ошибка конфигурации сервиса email");
  }

  try {
    /*
      ВАЖНО: 'onboarding@resend.dev' - это специальный адрес,
      который Resend разрешает использовать для тестов (пока вы не верифицировали свой домен).
      Письма будут приходить с этого адреса.
    */
    const { data, error } = await resend.emails.send({
      from: "MyApp <onboarding@resend.dev>",
      to: [to], // Resend ожидает массив email-адресов
      subject: "Подтверждение регистрации",
      html: `<p>Ваш код подтверждения: <b>${code}</b></p>`,
      text: `Ваш код подтверждения: ${code}`,
    });

    // Если API Resend вернуло ошибку (например, неверный ключ или email)
    if (error) {
      console.error("Ошибка от API Resend:", error);
      throw new Error(error.message || "Ошибка при отправке email");
    }

    // 'data' содержит ID успешной отправки, { id: '...' }
    console.log(`Email успешно отправлен на ${to} (через Resend), ID: ${data.id}`);
    return data; // Возвращаем успех

  } catch (e) {
    // Ловим любые другие ошибки (например, сетевой сбой)
    console.error("Критическая ошибка в sendVerificationEmail:", e.message);
    throw e; // Пробрасываем ошибку, чтобы authController ее поймал
  }
}

module.exports = { sendVerificationEmail };