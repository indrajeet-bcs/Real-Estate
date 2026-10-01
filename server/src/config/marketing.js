// Marketing module configuration (§Marketing Types / §Task Status / §Priority).
// These lists back the Create Task form and validation. Keeping them here (rather
// than hard-coded in the model enum) is deliberate: V1 requirement §"Allow future
// marketing types to be added through configuration" — new types can be appended
// without a schema migration, and the model validates against these arrays.

export const MARKETING_CHANNEL = {
  ONLINE: 'online',
  OFFLINE: 'offline',
}

// Online marketing activity types.
export const ONLINE_MARKETING_TYPES = [
  'facebook_campaign',
  'instagram_campaign',
  'google_ads',
  'seo',
  'website_update',
  'email_marketing',
  'whatsapp_campaign',
  'sms_campaign',
  'content_writing',
  'social_media_posting',
  'video_promotion',
  'lead_generation',
]

// Offline marketing activity types.
export const OFFLINE_MARKETING_TYPES = [
  'banner_installation',
  'hoarding',
  'newspaper_advertisement',
  'pamphlet_distribution',
  'society_campaign',
  'corporate_visit',
  'event',
  'property_expo',
  'stall_promotion',
  'builder_event',
  'door_to_door_campaign',
]

export const MARKETING_TYPES = [...ONLINE_MARKETING_TYPES, ...OFFLINE_MARKETING_TYPES]

// Channel a given marketing type belongs to (used to auto-fill channel + validate).
export const CHANNEL_BY_TYPE = Object.fromEntries([
  ...ONLINE_MARKETING_TYPES.map((t) => [t, MARKETING_CHANNEL.ONLINE]),
  ...OFFLINE_MARKETING_TYPES.map((t) => [t, MARKETING_CHANNEL.OFFLINE]),
])

// Stored task statuses (§Task Status). `overdue` is NOT stored — it is derived at
// read time (due date passed and task not completed/cancelled) so a task never
// gets "stuck" overdue after it is finished.
export const MARKETING_TASK_STATUS = [
  'draft',
  'pending',
  'in_progress',
  'on_hold',
  'completed',
  'cancelled',
]

export const MARKETING_PRIORITY = ['low', 'medium', 'high', 'urgent']

// Campaign lifecycle (§Campaigns · Status).
export const CAMPAIGN_STATUS = ['planned', 'active', 'paused', 'completed', 'cancelled']

// Is a task effectively overdue right now? (derived status helper)
export function isOverdue(task) {
  if (!task?.dueDate) return false
  if (['completed', 'cancelled'].includes(task.status)) return false
  return new Date(task.dueDate).getTime() < Date.now()
}
