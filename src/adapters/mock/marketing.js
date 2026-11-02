// Mock marketing adapter.
// Stands in for an email tool (ActiveCampaign, Mailchimp, ...). Campaigns are
// kept in memory and never sent anywhere.

const state = { campaigns: [] };
let counter = 0;

export async function createCampaign({ eventId, subject, body, recipients }) {
  if (!eventId) return { error: 'eventId is required' };
  if (!subject) return { error: 'subject is required' };
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return { error: 'recipients must be a non-empty array' };
  }
  const campaign = {
    id: `cmp-${++counter}`,
    eventId,
    subject,
    body: body ?? '',
    recipients,
    status: 'draft',
    createdAt: new Date().toISOString()
  };
  state.campaigns.push(campaign);
  console.log(`[ADAPTER:marketing] createCampaign ${campaign.id} (${recipients.length} recipients)`);
  return { campaign };
}

export async function sendCampaign(campaignId) {
  const campaign = state.campaigns.find((c) => c.id === campaignId);
  if (!campaign) return { error: `no campaign with id ${campaignId}` };
  if (campaign.status === 'sent') return { error: `${campaignId} was already sent` };
  campaign.status = 'sent';
  campaign.sentAt = new Date().toISOString();
  console.log(`[ADAPTER:marketing] sendCampaign ${campaignId} -> ${campaign.recipients.length} recipients`);
  return { sent: { id: campaign.id, recipients: campaign.recipients.length } };
}

export async function listCampaigns() {
  return { campaigns: state.campaigns };
}

export function __reset() {
  state.campaigns = [];
  counter = 0;
}
