import { randomBytes } from 'node:crypto';
import { writeFileSync, existsSync } from 'node:fs';
if (!existsSync('.env'))
  writeFileSync('.env', `RALLY_SECRET=${randomBytes(32).toString('hex')}\n`);
