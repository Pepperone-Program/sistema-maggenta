import axios, { AxiosError } from 'axios';
import dotenv from 'dotenv';

dotenv.config();

type Campaign = { id: number; name: string; sentDate?: string };
type TimedCampaignEvent = { campaignId: number; eventTime?: string };
type ClickedCampaignEvent = { campaignId: number; links?: Array<{ eventTime?: string }> };
type ContactStats = { clicked?: ClickedCampaignEvent[]; opened?: TimedCampaignEvent[] };

const args = process.argv.slice(2);
const valueOf = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const email = String(valueOf('--email') || '').trim().toLowerCase();
const eventName = String(valueOf('--event') || process.env.BREVO_CONVERSION_EVENT || 'orcamento_solicitado');
const conversionId = String(valueOf('--conversion-id') || `manual-${Date.now()}`);
const dryRun = args.includes('--dry-run');
const apiKey = String(process.env.BREVO_API_KEY || '').trim();
const headers = { 'api-key': apiKey, accept: 'application/json' };

function fail(message: string): never {
  console.error(`ERRO: ${message}`);
  process.exit(1);
}

function eventTime(event: TimedCampaignEvent | ClickedCampaignEvent): string {
  if ('links' in event) {
    return event.links?.map((link) => link.eventTime || '').sort().at(-1) || '';
  }
  return (event as TimedCampaignEvent).eventTime || '';
}

async function main(): Promise<void> {
  if (!apiKey) fail('BREVO_API_KEY nao encontrada no backend/.env.');
  if (!email) fail('Informe --email cliente@exemplo.com.');
  if (!/^[A-Za-z0-9_-]{1,255}$/.test(eventName)) fail('Nome de evento invalido.');

  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 7);
  const [campaignResponse, contactResponse, statsResponse] = await Promise.all([
    axios.get<{ campaigns?: Campaign[] }>('https://api.brevo.com/v3/emailCampaigns', {
      headers, params: { status: 'sent', limit: 3, offset: 0, sort: 'desc' }, timeout: 15000,
    }),
    axios.get<{ id: number }>(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
      headers, timeout: 15000,
    }),
    axios.get<ContactStats>(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}/campaignStats`, {
      headers,
      params: { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) },
      timeout: 15000,
    }),
  ]);

  const campaigns = campaignResponse.data.campaigns || [];
  const recentIds = new Set(campaigns.map((campaign) => campaign.id));
  const interactions = [
    ...(statsResponse.data.clicked || []).map((item) => ({ ...item, type: 'click' })),
    ...(statsResponse.data.opened || []).map((item) => ({ ...item, type: 'open' })),
  ]
    .filter((item) => {
      const timestamp = Date.parse(eventTime(item));
      return recentIds.has(item.campaignId) && Number.isFinite(timestamp) && timestamp >= start.getTime();
    })
    .sort((a, b) => eventTime(b).localeCompare(eventTime(a)));

  console.log('Ultimas campanhas enviadas:');
  for (const campaign of campaigns) {
    const touches = interactions.filter((item) => item.campaignId === campaign.id);
    console.log(`- #${campaign.id} ${campaign.name}: ${touches.length ? 'elegivel' : 'sem abertura/clique nos ultimos 7 dias'}`);
  }

  const lastTouch = interactions[0];
  if (!lastTouch) {
    fail('A Brevo nao pode atribuir a conversao: o contato nao abriu/clicou uma das 3 campanhas nos ultimos 7 dias.');
  }
  if (dryRun) {
    console.log(`OK: simulacao elegivel; a atribuicao sera decidida pela Brevo a partir da campanha #${lastTouch.campaignId}.`);
    return;
  }

  const sentAt = new Date().toISOString();
  await axios.post('https://api.brevo.com/v3/events', {
    event_name: eventName,
    identifiers: { email_id: email },
    event_date: sentAt,
    event_properties: {
      conversion_id: conversionId,
      conversion_type: 'manual',
      last_eligible_campaign_id: lastTouch.campaignId,
      last_eligible_interaction: lastTouch.type,
      last_eligible_interaction_time: eventTime(lastTouch),
    },
  }, { headers: { ...headers, 'content-type': 'application/json' }, timeout: 15000 });

  const verification = await axios.get<{ count: number; events?: Array<{ event_properties?: Record<string, unknown> }> }>(
    'https://api.brevo.com/v3/events',
    {
      headers,
      params: { contact_id: contactResponse.data.id, event_name: eventName, startDate: sentAt, endDate: new Date().toISOString(), limit: 10 },
      timeout: 15000,
    }
  );
  const confirmed = (verification.data.events || []).some(
    (event) => event.event_properties?.conversion_id === conversionId
  );
  if (!confirmed) fail('A API aceitou o POST, mas o evento ainda nao apareceu na consulta de verificacao.');

  console.log('OK: evento confirmado pela API da Brevo.');
  console.log(`A contabilizacao exige uma metrica ativa em Analytics > Conversions vinculada ao evento "${eventName}".`);
  console.log('O campaign_id nao pode ser forcado por API; a Brevo aplica o modelo de atribuicao configurado na conta.');
}

main().catch((error: unknown) => {
  const axiosError = error as AxiosError<{ message?: string; code?: string }>;
  console.error('Falha ao comunicar com a Brevo:', {
    status: axiosError.response?.status,
    code: axiosError.response?.data?.code,
    message: axiosError.response?.data?.message || axiosError.message,
  });
  process.exit(1);
});
