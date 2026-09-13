// Lets Node run the app's TypeScript directly in tests:
//   node --import ./tests/support/register.mjs tests/manual.mjs
// See ./ts-hooks.mjs for what it resolves and how it compiles.
import { register } from 'node:module';

register('./ts-hooks.mjs', import.meta.url);
