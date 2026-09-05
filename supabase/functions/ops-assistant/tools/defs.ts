import type { OpenAiToolDef } from './types.ts'
import { JOB_STATUSES, QUOTE_STATUSES, REQUEST_STATUSES } from './types.ts'

/** OpenAI-compatible tool definitions — the model reads name + description to pick a tool. */
export const TOOL_DEFINITIONS: OpenAiToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'search_requests',
      description:
        'List customer intake requests by status. Use for new intake (status new), already quoted intake (quoted), or archived.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: [...REQUEST_STATUSES],
            description: 'Request status. Use new for brand-new intake not yet quoted.',
          },
        },
        required: ['status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_jobs',
      description:
        'List jobs filtered by status. Use for unscheduled work, active/on-site jobs, completed jobs, etc.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: [...JOB_STATUSES],
            description: 'Job status filter. Use unscheduled for jobs needing assignment.',
          },
        },
        required: ['status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_quotes',
      description:
        'List quotes by status. Use for drafts, quotes waiting on customer (sent/viewed), etc. Never returns customer tokens.',
      parameters: {
        type: 'object',
        properties: {
          statuses: {
            type: 'array',
            items: { type: 'string', enum: [...QUOTE_STATUSES] },
            description: 'Quote statuses to include, e.g. ["sent","viewed"] for awaiting customer.',
          },
        },
        required: ['statuses'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_pipeline_summary',
      description:
        'Counts for the whole pipeline: new requests, quote statuses, unscheduled and active jobs. One call for overview questions.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_customer_history',
      description:
        'Find jobs and requests matching a customer name or email (partial match, min 3 chars).',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Customer name or email fragment, at least 3 characters.',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_schedule_job',
      description:
        'PROPOSE scheduling a job for a technician. This does NOT schedule anything — it creates a ' +
        'proposal the admin must confirm in the app. Find the job with search_jobs and the technician ' +
        'id first. After calling this, tell the admin what you proposed and that they must confirm it.',
      parameters: {
        type: 'object',
        properties: {
          job_id: { type: 'string', description: 'Job id from search_jobs.' },
          technician_id: { type: 'string', description: 'Technician profile id.' },
          scheduled_at: {
            type: 'string',
            description: 'Start time, ISO 8601 with timezone, e.g. 2026-09-05T14:00:00Z. Must be future.',
          },
          duration_min: { type: 'number', description: 'Minutes on site. Defaults to 60.' },
        },
        required: ['job_id', 'technician_id', 'scheduled_at'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_followup_email',
      description:
        'PROPOSE a follow-up email to the customer on a sent or viewed quote. This does NOT send ' +
        'anything — it goes to an outbox the admin reviews. Write the subject and body yourself, ' +
        'plain and short. After calling this, say it is waiting for their approval.',
      parameters: {
        type: 'object',
        properties: {
          quote_id: { type: 'string', description: 'Quote id from search_quotes.' },
          subject: { type: 'string', description: 'Email subject line.' },
          body: { type: 'string', description: 'Plain-text body, 20-4000 characters. No prices you did not read from a tool.' },
        },
        required: ['quote_id', 'subject', 'body'],
      },
    },
  },
]

export const TOOL_NAMES = new Set(TOOL_DEFINITIONS.map((t) => t.function.name))
