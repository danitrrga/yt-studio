'use client';

import { RouteErrorScreen } from '@/components/RouteErrorScreen';

export default function ClipError({
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
      routeLabel="this clip"
      routePath="/hub/[slug]"
    />
  );
}
