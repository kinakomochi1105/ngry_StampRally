import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Next regenerates AGENTS.md and CLAUDE.md on every build; this project keeps
  // its own notes in README.md.
  agentRules: false,
  // The libSQL client loads a native binding, which must stay outside the
  // bundle for the serverless function to build on Vercel.
  serverExternalPackages: ['@libsql/client', 'libsql'],
  // The encrypted nickname blocklist is read from disk at request time, so it
  // has to be traced into the serverless bundle explicitly.
  outputFileTracingIncludes: {
    '/api/register': ['./Config/forbidden'],
    '/api/recovery/setup': ['./Config/forbidden'],
  },
};

export default nextConfig;
