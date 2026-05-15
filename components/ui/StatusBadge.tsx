import { Badge } from './Badge';
import { STATUS_COLOR_VAR, STATUS_LABELS } from '@/lib/status';
import type { VideoStatus } from '@/lib/types';

export function StatusBadge({ status }: { status: VideoStatus }) {
  return <Badge colorVar={STATUS_COLOR_VAR[status]}>{STATUS_LABELS[status]}</Badge>;
}
