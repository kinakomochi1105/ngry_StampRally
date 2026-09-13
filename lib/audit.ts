import { db } from '@/db';
import { auditLog } from '@/db/schema';
import { nowSeconds } from './http';

/**
 * One line in the operations history. `actor` names who did it — the role and
 * the device name given at sign-in, such as `admin:本部PC` or `desk:受付1` — so
 * a shared password still leaves a trail. Never put a student's grade, class
 * or number, or a nickname, into `target`: ids are enough to look them up.
 */
export const auditStatement = (
  action: string,
  target: string,
  actor: string,
  now = nowSeconds(),
) => db().insert(auditLog).values({ action, target, actor, createdAt: now });
