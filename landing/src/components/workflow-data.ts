export type WorkflowStep = {
  number: string;
  title: string;
  description: string;
  note: string;
  status: string;
};

export type CircuitCardSide = 'left' | 'right' | 'below' | 'above';

export type CircuitPoint = {
  cx: number;
  cy: number;
  /** First side that fits keeps the card off the track at that node. */
  place: CircuitCardSide[];
};

/** Seven nodes along the workflow circuit SVG — one per journey step. */
export const WORKFLOW_CIRCUIT_POINTS: CircuitPoint[] = [
  { cx: 35, cy: 112, place: ['right'] },
  { cx: 35, cy: 220, place: ['below'] },
  { cx: 175, cy: 220, place: ['below'] },
  { cx: 310, cy: 132, place: ['below'] },
  { cx: 455, cy: 132, place: ['below'] },
  { cx: 585, cy: 318, place: ['left'] },
  { cx: 585, cy: 506, place: ['left'] },
];

/** Single track visiting every circuit point (background + animated stroke). */
export const WORKFLOW_CIRCUIT_PATH =
  'M35 112 V220 H175 C215 220 215 132 255 132 H310 H455 C520 132 585 220 585 318 V506';

/** One segment per step — wide invisible hit targets along the track between points. */
export const WORKFLOW_CIRCUIT_SEGMENTS: string[] = [
  'M35 112 V220',
  'M35 220 H175',
  'M175 220 C215 220 215 132 255 132 H310',
  'M310 132 H455',
  'M455 132 C520 132 585 220 585 318',
  'M585 318 V506',
];

export const WORKFLOW_CIRCUIT_VIEWBOX = { width: 620, height: 620 };

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
