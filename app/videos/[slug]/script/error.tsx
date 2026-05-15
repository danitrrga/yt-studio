'use client';

import { RouteErrorScreen } from '@/components/RouteErrorScreen';

export default function ScriptError({
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
      routeLabel="the script editor"
      routePath="/videos/[slug]/script"
    />
  );
}
