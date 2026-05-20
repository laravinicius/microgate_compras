import dotenv from 'dotenv';
dotenv.config();

import { sendBuyerNotification } from '../src/utils/email.js';

(async () => {
  try {
    const sent = await sendBuyerNotification({
      buyerEmail: 'vinicius@microgateinformatica.com.br',
      buyerName: 'Vinicius',
      orderId: 'TEST-0001',
      orderData: {
        items: [
          { productName: 'Produto Teste', quantity: 1, productValue: 10, passedValue: 10 }
        ],
        total: 10,
        urgency: 'normal',
        requesterName: 'Sistema',
        createdAt: new Date().toISOString()
      }
    });

    console.log('Email enviado com sucesso:', sent);
    process.exit(sent ? 0 : 1);
  } catch (err) {
    console.error('Falha ao enviar email de teste:', err);
    process.exit(2);
  }
})();
