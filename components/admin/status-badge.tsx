import { cn } from '@/lib/utils';

type Tone = 'amber' | 'green' | 'teal' | 'grey' | 'red' | 'ink' | 'outline';

// One colour language for order, payment, review and item statuses: amber
// means a person has to act, green is done/paid, teal is moving through the
// workshop, grey is waiting on the customer, red is stopped, ink is shipped.
const TONE_BY_STATUS: Record<string, Tone> = {
  review_required: 'amber',
  pending: 'grey',
  pending_payment: 'grey',
  unpaid: 'grey',
  paid: 'green',
  approved: 'green',
  ready_to_ship: 'green',
  published: 'green',
  active: 'green',
  preview_ready: 'teal',
  approved_for_production: 'teal',
  in_production: 'teal',
  generating: 'teal',
  ready: 'green',
  shipped: 'ink',
  cancelled: 'red',
  refunded: 'red',
  failed: 'red',
  rejected: 'red',
  disabled: 'red',
  suspended: 'amber',
  draft: 'outline',
  archived: 'grey',
  not_started: 'outline',
};

const TONE_CLASSES: Record<Tone, string> = {
  amber: 'bg-warning text-warning-foreground',
  green: 'bg-success-soft text-success',
  teal: 'bg-secondary text-secondary-foreground',
  grey: 'bg-muted text-muted-foreground',
  red: 'bg-danger-soft text-destructive',
  ink: 'bg-foreground/10 text-foreground',
  outline: 'bg-card text-muted-foreground ring-1 ring-inset ring-input',
};

export function statusTone(status: string): Tone {
  return TONE_BY_STATUS[status] ?? 'outline';
}

/**
 * Pill with a leading dot. Pass the raw status for the colour and the already
 * translated text as `label`; it renders anywhere, server or client.
 */
export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-bold',
        TONE_CLASSES[statusTone(status)],
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
