'use client';

import { RouteErrorScreen } from '@/components/RouteErrorScreen';

export default function HubDocError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorScreen
      error={error}
      reset={reset}
      routeLabel="this reference doc"
      routePath="/hub/docs/[slug]"
    />
  );
}
