'use client';

import { RouteErrorScreen } from '@/components/RouteErrorScreen';

export default function VideosError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorScreen error={error} reset={reset} routeLabel="the pipeline" routePath="/videos" />
  );
}
