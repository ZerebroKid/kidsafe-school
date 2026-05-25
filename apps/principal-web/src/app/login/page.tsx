import {brandTokens} from '@zerebro/shared-types';

/*
 * Temporary placeholder for /login -- doubles as the P2.1.3 swatch grid so
 * the brand tokens render in both webs with identical hex values. P2.2.2
 * replaces this with the phone + reCAPTCHA login form.
 */
export default function LoginPlaceholder() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-16">
      <header>
        <p className="text-sm uppercase tracking-widest text-text-muted">
          Zerebro Campus
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-text">
          Brand tokens preview
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          P2.1.3 sanity check. Real login form lands in P2.2.2.
        </p>
      </header>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {brandTokens.map(token => (
          <li
            key={token.name}
            className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3"
          >
            <span
              className={`h-10 w-10 shrink-0 rounded-md border border-border ${token.tw}`}
            />
            <span className="flex flex-col">
              <span className="font-mono text-sm text-text">{token.name}</span>
              <span className="font-mono text-xs text-text-muted">
                {token.hex}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
