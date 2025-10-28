const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com", 
  port: 465,
  secure: true,
  auth: {
    user: "shaternikgleb05@gmail.com",
    pass: "udqk xdqy copf akwv",
  },
});

async function sendVerificationEmail(to, code) {
  await transporter.sendMail({
    from: '"MyApp" <no-reply@example.com>',
    to,
    subject: "Подтверждение регистрации",
    text: `Ваш код подтверждения: ${code}`,
    html: `<p>Ваш код подтверждения: <b>${code}</b></p>`,
  });
}

module.exports = { sendVerificationEmail };
