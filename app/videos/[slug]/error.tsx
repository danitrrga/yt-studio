'use client';

import { RouteErrorScreen } from '@/components/RouteErrorScreen';

export default function VideoDetailError({
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
      routeLabel="the video dashboard"
      routePath="/videos/[slug]"
    />
  );
}
