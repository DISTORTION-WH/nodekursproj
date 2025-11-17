import { Resend } from "resend";

const RESEND_API_KEY: string | undefined = process.env.RESEND_API_KEY;

const EMAIL_FROM_ADDRESS: string =
  process.env.EMAIL_FROM_ADDRESS || "MyApp <onboarding@resend.dev>";

let resend: Resend | null = null;

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

export async function sendVerificationEmail(to: string, code: string): Promise<any> {
  if (!resend) {
    console.error(
      "Ошибка отправки: Resend не инициализирован. Проверьте RESEND_API_KEY."
    );
    throw new Error("Ошибка конфигурации сервиса email");
  }

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM_ADDRESS,
      to: [to],
      subject: "Подтверждение регистрации",
      html: `<p>Ваш код подтверждения: <b>${code}</b></p>`,
      text: `Ваш код подтверждения: ${code}`,
    });

    if (error) {
      console.error("Ошибка от API Resend:", error);
      throw new Error(error.message || "Ошибка при отправке email");
    }

    console.log(
      `Email успешно отправлен на ${to} (через Resend), ID: ${data?.id}`
    );
    return data;
  } catch (e: any) {
    console.error("Критическая ошибка в sendVerificationEmail:", e.message);
    throw e;
  }
}