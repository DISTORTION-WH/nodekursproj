// Services/emailService.js
const axios = require("axios");

// Ключ будет подхвачен из переменных окружения на Render
const RESEND_API_KEY = process.env.RESEND_API_KEY;

async function sendVerificationEmail(to, code) {
  
  // Если вы забыли добавить ключ в Render, в логах будет ошибка
  if (!RESEND_API_KEY) {
    console.error("!!! ОШИБКА: RESEND_API_KEY не установлен в .env или Render");
    // Бросаем ошибку, чтобы authController мог ее поймать
    throw new Error("Ошибка конфигурации сервиса email");
  }

  // Параметры для отправки письма
  const emailPayload = {
    /* ВАЖНО: Resend по умолчанию не разрешает слать письма с ЛЮБОГО адреса.
      Для тестов используйте специальный адрес 'onboarding@resend.dev'.
      Чтобы использовать ваш 'shaternikgleb05@gmail.com', вам нужно
      будет добавить и верифицировать свой домен в настройках Resend.
    */
    from: 'MyApp <onboarding@resend.dev>',
    to: [to], // Resend ожидает массив email-адресов
    subject: "Подтверждение регистрации",
    html: `<p>Ваш код подтверждения: <b>${code}</b></p>`,
    text: `Ваш код подтверждения: ${code}`,
  };

  try {
    // Отправляем запрос к API Resend
    await axios.post('https://api.resend.com/emails', emailPayload, {
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`Email успешно отправлен на ${to} (через Resend)`);

  } catch (error) {
    // Если Resend вернет ошибку, мы увидим ее в логах Render
    console.error("Ошибка отправки email через Resend:", error.response?.data || error.message);
    
    // Пробрасываем ошибку дальше, чтобы authController вернул "Ошибка регистрации"
    throw new Error(error.response?.data?.message || "Ошибка отправки email");
  }
}

module.exports = { sendVerificationEmail };