'use client';

import Link from 'next/link';

interface SubscriptionBannerProps {
  graceRemainingHours: number;
}

/**
 * Warning banner shown when the school is in the grace period (payment failed
 * but access has not yet been blocked). Turns red when < 12 hours remain.
 */
export function SubscriptionBanner({graceRemainingHours}: SubscriptionBannerProps) {
  const isUrgent = graceRemainingHours <= 12;

  const hours = Math.ceil(graceRemainingHours);
  const displayTime = hours >= 24
    ? `${Math.floor(hours / 24)} day${Math.floor(hours / 24) > 1 ? 's' : ''} ${hours % 24}h`
    : `${hours} hour${hours !== 1 ? 's' : ''}`;

  return (
    <div
      className={
        'flex items-center justify-between px-6 py-3 text-sm font-medium ' +
        (isUrgent
          ? 'bg-red-600 text-white'
          : 'bg-yellow-400 text-yellow-900')
      }
    >
      <p>
        Payment failed. Your access expires in <strong>{displayTime}</strong>.
      </p>
      <Link
        href="/subscription"
        className={
          'rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ' +
          (isUrgent
            ? 'bg-white text-red-700 hover:bg-red-50'
            : 'bg-yellow-800 text-white hover:bg-yellow-900')
        }
      >
        Renew Now
      </Link>
    </div>
  );
}
