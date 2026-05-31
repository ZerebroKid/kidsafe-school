import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@zerebro/shared-firebase', '@zerebro/shared-types'],
  // Hide the floating Next.js dev tools badge (the dark "N" circle that
  // overlaps the sidebar sign-out button in the bottom-left corner).
  devIndicators: false,
};

export default nextConfig;
