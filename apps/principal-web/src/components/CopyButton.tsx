'use client';

import {useState} from 'react';

/**
 * Clipboard-copy button used by the teacher-code page so the principal can
 * hand off a teacherCode via WhatsApp / SMS in one click.
 *
 * Mirror of the admin-web CopyButton (kept duplicated rather than promoted
 * to a shared package -- two ~50-line dumb components with no domain logic
 * isn't worth a workspace dep just yet).
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
