import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Zerebro Admin',
  description: 'Internal operations console for the Zerebro team.',
};

export default function RootLayout({
  children,
}: Readonly<{children: React.ReactNode}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-bg text-text">{children}</body>
    </html>
  );
}
