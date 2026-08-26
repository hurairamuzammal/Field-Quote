export type WorkflowStep = {
  number: string;
  title: string;
  description: string;
  note: string;
  status: string;
};

export const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    number: '01',
    title: 'Tell us what needs attention',
    description:
      'Submit the electrical issue, service address, preferred timing, and any useful photos or voice notes. No customer account is required.',
    note: 'Request details and media stay together',
    status: 'Request · new',
  },
  {
    number: '02',
    title: 'Your request reaches the team',
    description:
      'The loose details become one structured request in the service inbox, ready for a person to assess instead of getting lost across calls and messages.',
    note: 'Problem packaged into one clear record',
    status: 'Inbox · received',
  },
  {
    number: '03',
    title: 'We prepare and check the quote',
    description:
      'AI assistance organises the job against the price book, but the business reviews the scope and any unmatched work before anything is sent.',
    note: 'AI assists; the service team stays in control',
    status: 'Quote · reviewed',
  },
  {
    number: '04',
    title: 'Review and approve securely',
    description:
      'Open the private quote link, check the scope and totals, then accept and pay the required deposit through Stripe-hosted checkout.',
    note: 'No card details are handled by FieldQuote',
    status: 'Quote · accepted',
  },
  {
    number: '05',
    title: 'Your visit is confirmed',
    description:
      'The service team assigns the technician and confirms the appointment window once the quote and required deposit are in place.',
    note: 'Technician and time confirmed',
    status: 'Job · scheduled',
  },
  {
    number: '06',
    title: 'The work is completed and recorded',
    description:
      'The technician updates the job from arrival through completion, adding notes and completion photos before the job can be closed.',
    note: 'Completion requires evidence and notes',
    status: 'Job · completed',
  },
  {
    number: '07',
    title: 'Receive the finished job record',
    description:
      'You receive completion confirmation, supporting photos or notes, and a secure final-payment request when a remaining balance applies.',
    note: 'One clear ending, with the record retained',
    status: 'Payment · final',
  },
];
