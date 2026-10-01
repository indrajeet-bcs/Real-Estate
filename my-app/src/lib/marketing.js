// Marketing module option lists — mirrors server/src/config/marketing.js so the
// Create Task form and filters render without a config round-trip. (The API also
// exposes GET /marketing/config; these are the client-side defaults.)

export const ONLINE_MARKETING_TYPES = [
  'facebook_campaign', 'instagram_campaign', 'google_ads', 'seo', 'website_update',
  'email_marketing', 'whatsapp_campaign', 'sms_campaign', 'content_writing',
  'social_media_posting', 'video_promotion', 'lead_generation',
]

export const OFFLINE_MARKETING_TYPES = [
  'banner_installation', 'hoarding', 'newspaper_advertisement', 'pamphlet_distribution',
  'society_campaign', 'corporate_visit', 'event', 'property_expo', 'stall_promotion',
  'builder_event', 'door_to_door_campaign',
]

export const CHANNEL_BY_TYPE = Object.fromEntries([
  ...ONLINE_MARKETING_TYPES.map((t) => [t, 'online']),
  ...OFFLINE_MARKETING_TYPES.map((t) => [t, 'offline']),
])

export const TASK_STATUSES = ['draft', 'pending', 'in_progress', 'on_hold', 'completed', 'cancelled']
export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent']
export const CAMPAIGN_STATUSES = ['planned', 'active', 'paused', 'completed', 'cancelled']

// Priority pill classes (urgent isn't in STATUS_COLORS — priorities render here).
export const PRIORITY_COLORS = {
  low: 'bg-slate-100 text-slate-600 border-slate-200',
  medium: 'bg-sky-50 text-sky-700 border-sky-200',
  high: 'bg-amber-50 text-amber-700 border-amber-200',
  urgent: 'bg-red-50 text-red-700 border-red-200',
}

// The effective status shown to the user: an open task past its due date reads
// "overdue" even though it is stored as pending/in_progress/etc.
export function displayStatus(task) {
  if (task?.overdue && !['completed', 'cancelled'].includes(task.status)) return 'overdue'
  return task?.status
}
