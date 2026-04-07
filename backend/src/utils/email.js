import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const transporter = nodemailer.createTransport({
  host: env.smtpHost,
  port: env.smtpPort,
  secure: env.smtpPort === 465,
  auth:
    env.smtpUser && env.smtpPass
      ? {
          user: env.smtpUser,
          pass: env.smtpPass
        }
      : undefined
});

function money(value) {
  return Number(value || 0).toFixed(2);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export async function sendBuyerNotification({
  buyerEmail,
  buyerName,
  orderId,
  orderData
}) {
  if (!env.enableEmail || !buyerEmail) {
    return false;
  }

  try {
    const itemsHtml = orderData.items
      .map(
        (item) => `
          <tr>
            <td style="border: 1px solid #ddd; padding: 8px;">${escapeHtml(item.productName)}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${Number(item.quantity || 0)}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">R$ ${money(item.productValue)}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">R$ ${money(item.passedValue)}</td>
          </tr>
        `
      )
      .join('');

    const createdAt = orderData.createdAt
      ? new Date(orderData.createdAt)
      : new Date();

    const createdAtLabel = createdAt.toLocaleString('pt-BR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo'
    });

    const trackingUrl = `${env.frontendUrl}/?orderId=${orderId}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #1f1f1f; color: #fff; padding: 20px; border-radius: 6px; margin-bottom: 20px; border: 1px solid #3a3a3a; }
            .header h1 { margin: 0; font-size: 22px; }
            .content { background-color: #f7f9fb; padding: 20px; border-radius: 6px; }
            .section { margin-bottom: 20px; }
            .section h2 { font-size: 18px; color: #1f1f1f; border-bottom: 2px solid #4b5563; padding-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th { background-color: #4b5563; color: #fff; padding: 10px; text-align: left; }
            .total-row { background-color: #e5e7eb; font-weight: 700; }
            .total-row td { border: 1px solid #ddd; padding: 10px; }
            .button-wrap { text-align: center; margin-top: 20px; }
            .button { display: inline-block; background-color: #4b5563; color: #fff !important; padding: 12px 22px; border-radius: 6px; text-decoration: none; }
            .footer { font-size: 12px; text-align: center; color: #666; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Ordem #${orderId}</h1>
              <p>Solicitação de Compra Recebida</p>
            </div>
            <div class="content">
              <div class="section">
                <p>Olá <strong>${escapeHtml(buyerName || 'Comprador')}</strong>,</p>
                <p>Ordem criada para você. Confira o resumo abaixo:</p>
              </div>

              <div class="section">
                <h2>Resumo da Ordem</h2>
                <table>
                  <tr><td><strong>ID:</strong></td><td>#${orderId}</td></tr>
                  <tr><td><strong>Data:</strong></td><td>${escapeHtml(createdAtLabel)}</td></tr>
                  <tr><td><strong>Solicitante:</strong></td><td>${escapeHtml(orderData.requesterName || 'Sistema')}</td></tr>
                  <tr><td><strong>Urgência:</strong></td><td>${escapeHtml(orderData.urgency || 'normal')}</td></tr>
                </table>
              </div>

              <div class="section">
                <h2>Itens</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th style="text-align: center;">Qtd</th>
                      <th style="text-align: right;">Preço Unit.</th>
                      <th style="text-align: right;">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsHtml}
                    <tr class="total-row">
                      <td colspan="3" style="text-align: right;">Total</td>
                      <td style="text-align: right;">R$ ${money(orderData.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div class="button-wrap">
                <a href="${escapeHtml(trackingUrl)}" class="button">Acompanhar Ordem</a>
              </div>

              <div class="section">
                <p><small>Este email foi enviado automaticamente.</small></p>
              </div>
            </div>
            <div class="footer">
              <p>Microgate Compras</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: env.smtpFrom,
      to: buyerEmail,
      subject: `Ordem #${orderId} - Solicitação de Compra Recebida`,
      html: htmlContent
    });

    console.log(
      `[Email] Notificação enviada para ${buyerEmail} (order #${orderId})`,
      info.messageId
    );
    return true;
  } catch (error) {
    console.error(
      `[Email] Falha ao enviar para ${buyerEmail} (order #${orderId}):`,
      error.message
    );
    return false;
  }
}
