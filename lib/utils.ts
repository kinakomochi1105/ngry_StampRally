import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Shared admin-side timestamp formatting (Unix seconds → local date & time).
export const dateTime = (n: number | null, locale: string) =>
  n
    ? new Date(n * 1000).toLocaleString(locale, {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';
