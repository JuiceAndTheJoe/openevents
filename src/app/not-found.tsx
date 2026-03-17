import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 rounded-full bg-blue-100 p-4">
        <svg
          className="h-12 w-12 text-[#5c8bd9]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h1 className="mb-2 text-4xl font-bold text-gray-900">404</h1>
      <h2 className="mb-4 text-xl font-semibold text-gray-700">Page not found</h2>
      <p className="mb-8 max-w-md text-gray-600">
        Sorry, we couldn&apos;t find the page you&apos;re looking for. The event may have been removed,
        or the link might be incorrect.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        <Link href="/">
          <Button>Go to homepage</Button>
        </Link>
        <Link href="/events">
          <Button variant="outline">Browse all events</Button>
        </Link>
      </div>
    </div>
  );
}
