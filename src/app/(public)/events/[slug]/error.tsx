'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function EventError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Event Page Error]', error);
  }, [error]);

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 rounded-full bg-red-100 p-4">
        <svg
          className="h-12 w-12 text-red-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h2 className="mb-2 text-2xl font-bold text-gray-900">
        Something went wrong loading this event
      </h2>
      <p className="mb-6 max-w-md text-gray-600">
        We couldn&apos;t load the event details. Please try again or browse other events.
      </p>
      <div className="flex gap-4">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="outline" onClick={() => (window.location.href = '/events')}>
          Browse other events
        </Button>
      </div>
    </div>
  );
}
