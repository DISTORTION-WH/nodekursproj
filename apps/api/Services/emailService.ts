class EmailService {
  async sendVerificationEmail(to: string, code: string): Promise<void> {
    const recipient = to.trim().toLowerCase();
    const serviceId = process.env.EMAILJS_SERVICE_ID;
    const templateId = process.env.EMAILJS_TEMPLATE_ID;
    const publicKey = process.env.EMAILJS_PUBLIC_KEY;
    const privateKey = process.env.EMAILJS_PRIVATE_KEY;

    if (!recipient) {
      throw new Error("Email recipient is empty");
    }

    if (!serviceId || !templateId || !publicKey || !privateKey) {
      console.error("EmailJS is not configured");
      throw new Error("Email service is not configured");
    }

    const data = {
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      accessToken: privateKey,
      template_params: {
        to_email: recipient,
        email: recipient,
        user_email: recipient,
        recipient_email: recipient,
        code,
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
        console.log(`Verification email was sent to ${recipient}`);
        return;
      }

      const errorText = await response.text();
      console.error("EmailJS error:", errorText);
      throw new Error(`Email service rejected the request: ${errorText}`);
    } catch (error) {
      console.error("Network error while sending email:", error);
      throw error;
    }
  }
}

export default new EmailService();
