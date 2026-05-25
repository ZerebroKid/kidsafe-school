/**
 * Shared brand-token reference table. Imported by both web apps' temporary
 * P2.1.3 swatch grids and by the RN apps' future debug screens so all four
 * surfaces can render an identical visual diff when we change the palette.
 *
 * If you edit a hex here you MUST also edit:
 *   - apps/principal-web/src/app/globals.css
 *   - apps/admin-web/src/app/globals.css
 *   - apps/kids/src/theme.ts
 *   - apps/guardian/src/theme.ts
 */
export const brandTokens = [
  {name: 'bg', hex: '#0f172a', tw: 'bg-bg'},
  {name: 'surface', hex: '#1e293b', tw: 'bg-surface'},
  {name: 'surface-alt', hex: '#334155', tw: 'bg-surface-alt'},
  {name: 'text', hex: '#f8fafc', tw: 'bg-text'},
  {name: 'text-muted', hex: '#94a3b8', tw: 'bg-text-muted'},
  {name: 'primary', hex: '#38bdf8', tw: 'bg-primary'},
  {name: 'primary-text', hex: '#0f172a', tw: 'bg-primary-text'},
  {name: 'danger', hex: '#f87171', tw: 'bg-danger'},
  {name: 'success', hex: '#4ade80', tw: 'bg-success'},
  {name: 'warning', hex: '#facc15', tw: 'bg-warning'},
  {name: 'border', hex: '#334155', tw: 'bg-border'},
] as const;

export type BrandToken = (typeof brandTokens)[number];
