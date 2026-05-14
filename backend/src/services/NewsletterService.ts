import { getConnection } from '@database/connection';
import { throwError } from '@utils/helpers';

export interface NewsletterLead {
  id_lead: number;
  lead_email: string;
  created_at: string;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class NewsletterService {
  static async createLead(email: string): Promise<NewsletterLead> {
    const leadEmail = String(email || '').trim().toLowerCase();

    if (!emailRegex.test(leadEmail) || leadEmail.length > 150) {
      throwError('INVALID_EMAIL', 'Informe um e-mail valido', 400);
    }

    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      const [lastRows] = await connection.execute(
        'SELECT id_lead FROM newsletter_leads ORDER BY id_lead DESC LIMIT 1 FOR UPDATE'
      );
      const rows = lastRows as Array<{ id_lead: number }>;
      const nextId = (rows[0]?.id_lead || 0) + 1;

      await connection.execute(
        'INSERT INTO newsletter_leads (id_lead, lead_email) VALUES (?, ?)',
        [nextId, leadEmail]
      );

      const [createdRows] = await connection.execute(
        `SELECT id_lead, lead_email, created_at
         FROM newsletter_leads
         WHERE id_lead = ?
         LIMIT 1`,
        [nextId]
      );

      await connection.commit();

      const created = (createdRows as NewsletterLead[])[0];
      if (!created) {
        throwError('LEAD_NOT_CREATED', 'Nao foi possivel criar o lead', 500);
      }

      return created;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
