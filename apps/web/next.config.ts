import type { NextConfig } from 'next';

const config: NextConfig = {
  // Deze pakketten praten met sockets en het bestandssysteem; die horen niet
  // door de bundler heen. `@meetinghub/db` en `-core` staan erbij sinds de
  // instrumentatie: die importeert de database bij het opstarten, en zonder
  // deze regel probeert webpack `node:crypto` en `node:fs` mee te bundelen voor
  // de edge-runtime, waar ze niet bestaan.
  serverExternalPackages: [
    'pg-boss',
    'postgres',
    '@anthropic-ai/sdk',
    '@meetinghub/db',
    '@meetinghub/core',
  ],
};

export default config;
