'use client';

import { RouteErrorScreen } from '@/components/RouteErrorScreen';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteErrorScreen error={error} reset={reset} routeLabel="this page" routePath="/" />;
}
