import nodemailer from "nodemailer";
import logger from "../utils/logger";

// Usa Postfix local (porta 25) - sem autenticação
const transporter = nodemailer.createTransport({
  host: "127.0.0.1",
  port: 25,
  secure: false,
  tls: { rejectUnauthorized: false },
});

interface ForwardEmailOptions {
  originalFrom: string;
  originalTo: string;
  originalSubject: string;
  htmlBody: string;
  textBody: string;
  forwardTo: string;
  forwardedBy: string;
}

export async function forwardEmail(options: ForwardEmailOptions): Promise<void> {
  const { originalFrom, originalTo, originalSubject, htmlBody, textBody, forwardTo, forwardedBy } = options;

  const subject = `Fwd: ${originalSubject}`;
  const separator = "---------- Forwarded message ----------";

  const textContent = [
    `${separator}`,
    `From: ${originalFrom}`,
    `To: ${originalTo}`,
    `Subject: ${originalSubject}`,
    `Forwarded by: ${forwardedBy}`,
    "",
    textBody,
  ].join("\n");

  const htmlContent = `
    <div style="border-top: 1px solid #ccc; margin-top: 16px; padding-top: 16px;">
      <p style="color: #666; font-size: 12px;">
        ${separator}<br/>
        <b>From:</b> ${originalFrom}<br/>
        <b>To:</b> ${originalTo}<br/>
        <b>Subject:</b> ${originalSubject}<br/>
        <b>Forwarded by:</b> ${forwardedBy}
      </p>
    </div>
    ${htmlBody}
  `;

  await transporter.sendMail({
    from: `MockMail <noreply@mockmail.dev>`,
    to: forwardTo,
    subject,
    text: textContent,
    html: htmlContent,
  });

  logger.info(`MAILER - Email forwarded to ${forwardTo} (original from: ${originalFrom})`);
}

export async function sendNotificationEmail(
  to: string,
  content: { subject: string; text: string; html: string }
): Promise<void> {
  await transporter.sendMail({
    from: `MockMail <noreply@mockmail.dev>`,
    to,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });
  logger.info(`MAILER - Notification sent to ${to}: ${content.subject}`);
}
