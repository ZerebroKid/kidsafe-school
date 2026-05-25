import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@zerebro/shared-firebase', '@zerebro/shared-types'],
};

export default nextConfig;
