import { desc, eq } from 'drizzle-orm';
import { db, writeBatch } from '@/db';
import {
  auditLog,
  participants,
  spotActivity,
  spotReports,
  stamps,
} from '@/db/schema';
import { requireAdmin } from '@/lib/admin';
import { auditStatement } from '@/lib/audit';
import { event } from '@/lib/event';
import { blocklistProblem } from '@/lib/forbidden';
import { bodyJson, json, nowSeconds, route, UserError } from '@/lib/http';
import {
  configuration,
  hashSecret,
  saveConfigurationStatement,
  saveSecretStatement,
  secretHash,
  validateSettings,
  type SecretName,
} from '@/lib/settings';

export const GET = route(
  'GET /api/admin/settings',
  '設定を取得できませんでした。',
  async (request) => {
    await requireAdmin(request);
    const [settings, staffPin, sitePassword, deskPassword, logs, blocklist] =
      await Promise.all([
        configuration(),
        secretHash('staff-pin'),
        secretHash('site-password'),
        secretHash('desk-password'),
        db()
          .select({
            action: auditLog.action,
            target: auditLog.target,
            actor: auditLog.actor,
            createdAt: auditLog.createdAt,
          })
          .from(auditLog)
          .orderBy(desc(auditLog.id))
          .limit(30),
        blocklistProblem(),
      ]);
    return json({
      settings,
      // Only whether these exist; the values themselves never leave the server.
      staffPinSet: staffPin !== null,
      sitePasswordSet: sitePassword !== null,
      deskPasswordSet: deskPassword !== null,
      logs,
      // Registration refuses every nickname while the blocklist cannot be
      // read, so the console says so before the festival does.
      warnings: blocklist
        ? [
            'ニックネームの禁止語リストを読み込めないため、新規登録ができません。NICKNAME_BLOCKLIST_KEY と NICKNAME_BLOCKLIST_IV を確認してください。',
          ]
        : [],
    });
  },
);

/** How each console secret is checked, and what the history calls it. */
const secretRules: Record<
  string,
  {
    name: SecretName;
    field: string;
    valid: (value: string) => boolean;
    message: string;
    audit: string;
    result: string;
  }
> = {
  // The word visitors type before the participant screens answer. Clearing
  // it reopens the site; changing it invalidates every pass already handed
  // out, because the signature covers the stored hash.
  sitePassword: {
    name: 'site-password',
    field: 'password',
    valid: (value) => value.length >= 4 && value.length <= 64,
    message: '合言葉は4〜64文字で入力してください。',
    audit: 'site_password',
    result: 'sitePasswordSet',
  },
  // Typed on a participant's phone, so it has to survive guessing under the
  // limits in /api/reward: six digits at least.
  staffPin: {
    name: 'staff-pin',
    field: 'pin',
    valid: (value) => /^\d{6,8}$/.test(value),
    message: '係員用暗証番号は6〜8桁の数字で入力してください。',
    audit: 'staff_pin',
    result: 'staffPinSet',
  },
  // Signs reward-desk devices in with the desk role only. Changing it signs
  // every desk device out.
  deskPassword: {
    name: 'desk-password',
    field: 'password',
    valid: (value) => value.length >= 8 && value.length <= 64,
    message: '引き換え係のパスワードは8〜64文字で入力してください。',
    audit: 'desk_password',
    result: 'deskPasswordSet',
  },
};

export const POST = route(
  'POST /api/admin/settings',
  '設定を保存できませんでした。',
  async (request) => {
    const session = await requireAdmin(request, { mutation: true });
    const data = await bodyJson(request);
    const now = nowSeconds();
    const audit = (action: string) =>
      auditStatement(action, event.id, session.actor, now);

    if (data.action === 'purge') {
      if (data.confirm !== '全参加データを削除')
        throw new UserError('確認文字が一致しません。');
      await writeBatch([
        db().delete(stamps).where(eq(stamps.eventId, event.id)),
        db().delete(spotActivity).where(eq(spotActivity.eventId, event.id)),
        db().delete(spotReports).where(eq(spotReports.eventId, event.id)),
        db().delete(participants).where(eq(participants.eventId, event.id)),
        audit('purge_event'),
      ]);
      return json({ ok: true });
    }

    const secret =
      typeof data.action === 'string' && Object.hasOwn(secretRules, data.action)
        ? secretRules[data.action]
        : null;
    if (secret) {
      if (data.clear === true) {
        await writeBatch([
          saveSecretStatement(secret.name, null),
          audit(secret.audit + '_clear'),
        ]);
        return json({ ok: true, [secret.result]: false });
      }
      const raw = data[secret.field];
      const value = typeof raw === 'string' ? raw.trim() : '';
      if (!secret.valid(value)) throw new UserError(secret.message);
      await writeBatch([
        saveSecretStatement(secret.name, await hashSecret(secret.name, value)),
        audit(secret.audit + '_set'),
      ]);
      return json({ ok: true, [secret.result]: true });
    }

    const settings = validateSettings(data.settings);
    await writeBatch([
      saveConfigurationStatement(settings),
      audit('save_settings'),
    ]);
    return json({ ok: true });
  },
);
