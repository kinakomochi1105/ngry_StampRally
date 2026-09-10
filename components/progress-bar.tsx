'use client';
/* eslint-disable jsx-a11y/prefer-tag-over-role -- see note below */

/**
 * Native <progress> cannot animate between values, so the fill is a plain
 * element whose width transitions. role="progressbar" plus the aria-value*
 * attributes keep it equivalent to <progress> for assistive technology.
 */
export function ProgressBar({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label: string;
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const complete = max > 0 && value >= max;
  return (
    <div
      className={complete ? 'rally-progress complete' : 'rally-progress'}
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max || 1}
    >
      <span
        className="rally-progress-fill"
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  );
}
