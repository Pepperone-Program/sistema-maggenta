import axios, { AxiosError } from 'axios';

type CampaignEvent = { campaignId: number; eventTime?: string };
type ClickedCampaign = { campaignId: number; links?: Array<{ eventTime?: string }> };
type ContactCampaignStats = {
  clicked?: ClickedCampaign[];
  opened?: CampaignEvent[];
};

export class BrevoConversionService {
  private static get apiKey(): string {
    return String(process.env.BREVO_API_KEY || '').trim();
  }

  private static readonly attributionDays = 7;

  static get enabled(): boolean {
    return Boolean(this.apiKey);
  }

  private static eventTime(event: CampaignEvent | ClickedCampaign): string {
    if ('links' in event) {
      return event.links?.map((link) => link.eventTime || '').sort().at(-1) || '';
    }
    return (event as CampaignEvent).eventTime || '';
  }

  private static selectCampaign(stats: ContactCampaignStats): CampaignEvent | ClickedCampaign | null {
    const groups: Array<Array<CampaignEvent | ClickedCampaign> | undefined> = [
      stats.clicked,
      stats.opened,
    ];

    for (const group of groups) {
      if (!group?.length) continue;
      return [...group].sort((a, b) => this.eventTime(b).localeCompare(this.eventTime(a)))[0];
    }
    return null;
  }

  static async registerQuote(email: string, quoteId: number, quoteDate?: string): Promise<void> {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!this.enabled || !normalizedEmail) return;

    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - this.attributionDays);

    try {
      const headers = { 'api-key': this.apiKey, accept: 'application/json' };
      const statsResponse = await axios.get<ContactCampaignStats>(
        `https://api.brevo.com/v3/contacts/${encodeURIComponent(normalizedEmail)}/campaignStats`,
        {
          headers,
          params: {
            startDate: start.toISOString().slice(0, 10),
            endDate: end.toISOString().slice(0, 10),
          },
          timeout: 10000,
        }
      );
      const campaign = this.selectCampaign(statsResponse.data);
      const interactionTimestamp = campaign ? Date.parse(this.eventTime(campaign)) : NaN;
      if (!campaign || !Number.isFinite(interactionTimestamp) || interactionTimestamp < start.getTime()) return;

      await axios.post(
        'https://api.brevo.com/v3/events',
        {
          event_name: process.env.BREVO_CONVERSION_EVENT || 'orcamento_solicitado',
          identifiers: { email_id: normalizedEmail },
          event_date: new Date().toISOString(),
          event_properties: {
            orcamento_id: quoteId,
            campaign_id: campaign.campaignId,
            attribution_event_time: this.eventTime(campaign),
            conversion_type: 'quote_request',
            original_quote_date: quoteDate || '',
          },
        },
        { headers: { ...headers, 'content-type': 'application/json' }, timeout: 10000 }
      );
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 404) return;
      console.error('[BrevoConversionService] Falha ao registrar conversao do orcamento', {
        quoteId,
        status: axiosError.response?.status,
        message: axiosError.message,
      });
    }
  }
}
