import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@zerebro/shared-firebase', '@zerebro/shared-types'],
  devIndicators: false,
};

export default nextConfig;
