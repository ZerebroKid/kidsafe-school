'use client';

import {useState} from 'react';

/**
 * Small clipboard-copy button used in school/principal detail pages so the
 * admin can hand off an inviteCode via WhatsApp / SMS in one click.
 *
 * Falls back gracefully when `navigator.clipboard` is unavailable (older
 * browsers, insecure contexts) by selecting the value in a hidden textarea
 * and calling `document.execCommand('copy')`.
 */
export function CopyButton({
  value,
  label = 'Copy',
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={
        className ??
        'rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-alt'
      }
    >
      {copied ? 'Copied!' : label}
    </button>
  );
}
