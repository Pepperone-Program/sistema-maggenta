import { throwError } from '@utils/helpers';

type ContactPayload = {
  nome?: string;
  empresa?: string;
  email?: string;
  telefone?: string;
  assunto?: string;
  mensagem?: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export class ContatoService {
  static async enviarMensagem(data: ContactPayload) {
    const resendApiKey = process.env.RESEND_API_KEY?.trim();
    const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();
    if (!resendApiKey || !fromEmail) {
      throwError('RESEND_CONFIG_ERROR', 'Resend nao configurado para envio de contato', 500);
    }

    const nome = String(data.nome || '').trim();
    const empresa = String(data.empresa || '').trim();
    const email = String(data.email || '').trim();
    const telefone = String(data.telefone || '').trim();
    const assunto = String(data.assunto || 'Contato pelo site').trim();
    const mensagem = String(data.mensagem || '').trim();

    if (!nome || !email || !mensagem) {
      throwError('INVALID_CONTACT', 'Nome, email e mensagem sao obrigatorios', 400);
    }

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
        <h2>Nova mensagem pelo site Maggenta</h2>
        <p><strong>Nome:</strong> ${escapeHtml(nome)}</p>
        <p><strong>Empresa:</strong> ${escapeHtml(empresa || '-')}</p>
        <p><strong>E-mail:</strong> ${escapeHtml(email)}</p>
        <p><strong>Telefone:</strong> ${escapeHtml(telefone || '-')}</p>
        <p><strong>Assunto:</strong> ${escapeHtml(assunto)}</p>
        <hr />
        <p style="white-space:pre-line">${escapeHtml(mensagem)}</p>
      </div>
    `;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [fromEmail],
        subject: `Contato Maggenta: ${assunto}`,
        html,
      }),
    });

    const result = (await response.json().catch(() => null)) as { message?: string } | null;
    if (!response.ok) {
      throwError(
        'RESEND_SEND_ERROR',
        result?.message || `Falha ao enviar email: HTTP ${response.status}`,
        500
      );
    }

    return result;
  }
}
