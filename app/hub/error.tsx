'use client';

import { RouteErrorScreen } from '@/components/RouteErrorScreen';

export default function HubError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteErrorScreen error={error} reset={reset} routeLabel="the hub" routePath="/hub" />;
}
