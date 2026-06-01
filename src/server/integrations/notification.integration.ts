/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Integração de Notificações (E-mail e WhatsApp)
 * Responsável por alertar o usuário sobre novas vagas de alto match ou dicas de carreira.
 */
export class NotificationIntegration {
  static async sendEmail(to: string, subject: string, body: string): Promise<void> {
    // TODO: Implementar envio via Nodemailer, AWS SES, ou SendGrid
    console.log(`[Integration] Enviando e-mail para ${to}...`);
  }

  static async sendWhatsApp(phone: string, message: string): Promise<void> {
    // TODO: Implementar envio via Twilio, WATI, ou API Oficial do WhatsApp
    console.log(`[Integration] Enviando mensagem de WhatsApp para ${phone}...`);
  }
}
