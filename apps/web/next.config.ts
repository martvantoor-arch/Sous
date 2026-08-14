import type { NextConfig } from 'next';

const config: NextConfig = {
  // Deze pakketten praten met sockets en het bestandssysteem; die horen niet
  // door de bundler heen.
  serverExternalPackages: ['pg-boss', 'postgres', '@anthropic-ai/sdk'],
};

export default config;
