import { sendNotificationEmail } from "./mailer.service";
import User from "../models/User";
import logger from "../utils/logger";

export async function notifyEmailReceived(
  userId: string,
  emailData: { from: string; to: string; subject: string; date: string }
): Promise<void> {
  try {
    const user = await User.findById(userId).lean();
    if (!user) return;

    const notifications = (user as any).notifications;
    if (!notifications?.emailOnReceive) return;
    if (notifications.digestFrequency !== "instant") return;

    await sendNotificationEmail(user.email, {
      subject: `[MockMail] Novo email: ${emailData.subject}`,
      text: [
        `Você recebeu um email na caixa ${emailData.to}.`,
        "",
        `De: ${emailData.from}`,
        `Assunto: ${emailData.subject}`,
        `Data: ${emailData.date}`,
        "",
        "Acesse: https://mockmail.dev/admin/emails",
      ].join("\n"),
      html: `
        <div style="font-family: sans-serif; max-width: 500px;">
          <h2 style="color: #5636d1;">Novo email recebido</h2>
          <p>Você recebeu um email na caixa <strong>${emailData.to}</strong>.</p>
          <table style="border-collapse: collapse; width: 100%;">
            <tr><td style="padding: 4px 8px; color: #666;">De:</td><td style="padding: 4px 8px;">${emailData.from}</td></tr>
            <tr><td style="padding: 4px 8px; color: #666;">Assunto:</td><td style="padding: 4px 8px;">${emailData.subject}</td></tr>
            <tr><td style="padding: 4px 8px; color: #666;">Data:</td><td style="padding: 4px 8px;">${emailData.date}</td></tr>
          </table>
          <p style="margin-top: 16px;">
            <a href="https://mockmail.dev/admin/emails" style="color: #5636d1;">Ver no dashboard</a>
          </p>
        </div>
      `,
    });

    logger.info(`NOTIFICATION - Sent email notification to ${user.email} for email from ${emailData.from}`);
  } catch (error) {
    logger.warn(`NOTIFICATION - Failed to send: ${(error as Error).message}`);
  }
}
