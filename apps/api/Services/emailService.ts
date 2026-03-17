class EmailService {
  async sendVerificationEmail(to: string, code: string): Promise<void> {
    const serviceId = process.env.EMAILJS_SERVICE_ID;
    const templateId = process.env.EMAILJS_TEMPLATE_ID;
    const publicKey = process.env.EMAILJS_PUBLIC_KEY;
    const privateKey = process.env.EMAILJS_PRIVATE_KEY;

    if (!serviceId || !templateId || !publicKey || !privateKey) {
      console.error("⚠️ EmailJS не настроен (проверь .env)");
      return;
    }

    const data = {
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      accessToken: privateKey, 
      template_params: {
        to_email: to,  
        code: code,   
      },
    };

    try {
      const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        console.log(`📧 Письмо отправлено на ${to}`);
      } else {
        const errorText = await response.text();
        console.error("❌ Ошибка EmailJS:", errorText);
      }
    } catch (error) {
      console.error("❌ Ошибка сети при отправке письма:", error);
    }
  }
}

export default new EmailService();