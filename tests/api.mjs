import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
const base = process.env.TEST_BASE_URL || 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname))
  throw Error('Tests write data and must run locally.');
const password = process.env.ADMIN_PASSWORD;
if (!password) throw Error('Run with --env-file=.env');
const tracked = [];
let adminCookie = '';
async function req(path, { data, cookie = '', origin = base } = {}) {
  const r = await fetch(base + path, {
    method: data === undefined ? 'GET' : 'POST',
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(data !== undefined
        ? { 'Content-Type': 'application/json', origin }
        : {}),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const text = await r.text();
  let d;
  try {
    d = JSON.parse(text);
  } catch {
    d = { error: text };
  }
  return {
    status: r.status,
    data: d,
    cookie: r.headers.get('set-cookie')?.split(';')[0],
    headers: r.headers,
  };
}
async function adm(path, data) {
  return req('/api/admin/' + path, { data, cookie: adminCookie });
}
async function register(data) {
  const r = await req('/api/register', { data });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.match(r.headers.get('set-cookie'), /HttpOnly/);
  const pass = await req('/api/passport', { cookie: r.cookie });
  tracked.push(pass.data.profile.id);
  return { cookie: r.cookie, profile: pass.data.profile };
}
let original;
try {
  for (const path of ['participants', 'spots', 'settings', 'export'])
    assert.equal((await req('/api/admin/' + path)).status, 401);
  assert.equal((await req('/api/passport')).data.profile, null);
  assert.equal(
    (await req('/api/admin/login', { data: { password: 'incorrect' } })).status,
    401,
  );
  const login = await req('/api/admin/login', { data: { password } });
  assert.equal(login.status, 200);
  adminCookie = login.cookie;
  original = (await adm('settings')).data.settings;
  const seeded = await adm('spots');
  if (!seeded.data.spots.length)
    assert.equal((await adm('spots', { action: 'seed' })).status, 200);
  const managed = (await adm('spots')).data.spots.filter((s) => s.active);
  assert.ok(managed.length > 0);
  const studentInput = {
    kind: 'student',
    grade: original.grades[0],
    className: original.classes.at(-1),
    number: original.maxNumber,
  };
  const student = await register(studentInput);
  assert.equal(
    (await req('/api/register', { data: studentInput })).status,
    409,
  );
  assert.equal(
    (
      await req('/api/register', {
        data: { ...studentInput, number: original.maxNumber + 1 },
      })
    ).status,
    400,
  );
  const guests = await Promise.all(
    Array.from({ length: 12 }, () => register({ kind: 'guest' })),
  );
  assert.equal(new Set(guests.map((g) => g.profile.guestNumber)).size, 12);
  assert.ok(guests.every((g) => g.profile.kind === 'guest'));
  for (const guest of guests) {
    const p = (await req('/api/passport', { cookie: guest.cookie })).data;
    assert.equal(p.profile.id, guest.profile.id);
    assert.deepEqual(p.stamps, []);
    assert.equal(p.participants, undefined);
  }
  assert.equal(
    (await req('/api/admin/participants', { cookie: student.cookie })).status,
    401,
  );
  assert.equal(
    (
      await req('/api/admin/settings', {
        cookie: adminCookie,
        origin: 'https://attacker.invalid',
        data: { settings: original },
      })
    ).status,
    403,
  );
  const scan = () =>
    req('/api/stamp', {
      cookie: student.cookie,
      data: { code: managed[0].code },
    });
  const results = await Promise.all(Array.from({ length: 24 }, scan));
  assert.ok(results.every((r) => r.status === 200));
  assert.equal(results.filter((r) => !r.data.duplicate).length, 1);
  assert.equal(
    (await req('/api/passport', { cookie: student.cookie })).data.stamps.length,
    1,
  );
  assert.equal(
    (
      await req('/api/stamp', {
        cookie: student.cookie,
        data: { code: managed[0].code + 'tamper' },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await req('/api/stamp', {
        cookie: student.cookie,
        origin: 'https://attacker.invalid',
        data: { code: managed[0].code },
      })
    ).status,
    403,
  );
  for (const spot of managed.slice(1))
    assert.equal(
      (
        await req('/api/stamp', {
          cookie: student.cookie,
          data: { code: spot.code },
        })
      ).status,
      200,
    );
  const ranking = await adm('participants?sort=rank');
  assert.equal(ranking.status, 200, JSON.stringify(ranking.data));
  const row = ranking.data.rows.find((r) => r.id === student.profile.id);
  assert.equal(row.stampCount, managed.length);
  assert.ok(row.ranking >= 1);
  assert.ok(ranking.data.stats.completed >= 1);
  assert.equal(
    (await adm('participants?id=' + student.profile.id)).data.stamps.length,
    managed.length,
  );
  assert.ok(
    (await adm('participants?kind=guest')).data.rows.every(
      (r) => r.kind === 'guest',
    ),
  );
  assert.equal(
    (await adm('participants?q=' + encodeURIComponent('not-found%_'))).status,
    200,
  );
  const originalSpot = managed[0];
  try {
    assert.equal(
      (
        await adm('spots', {
          ...originalSpot,
          name: originalSpot.name + '（確認）',
        })
      ).status,
      200,
    );
    assert.ok(
      (await req('/api/passport', { cookie: student.cookie })).data.spots.some(
        (s) => s.id === originalSpot.id && s.name.endsWith('（確認）'),
      ),
    );
    assert.equal(
      (await adm('spots', { ...originalSpot, active: 0 })).status,
      200,
    );
    assert.ok(
      !(await req('/api/passport', { cookie: student.cookie })).data.spots.some(
        (s) => s.id === originalSpot.id,
      ),
    );
    assert.equal(
      (
        await req('/api/stamp', {
          cookie: student.cookie,
          data: { code: originalSpot.code },
        })
      ).status,
      400,
    );
  } finally {
    await adm('spots', originalSpot);
  }
  const qr = QRCode.create(managed[0].code, { errorCorrectionLevel: 'M' }),
    scale = 5,
    w = (qr.modules.size + 8) * scale,
    pixels = new Uint8ClampedArray(w * w * 4).fill(255);
  for (let y = 0; y < qr.modules.size; y++)
    for (let x = 0; x < qr.modules.size; x++)
      if (qr.modules.get(y, x))
        for (let dy = 0; dy < scale; dy++)
          for (let dx = 0; dx < scale; dx++) {
            const i = (((y + 4) * scale + dy) * w + (x + 4) * scale + dx) * 4;
            pixels[i] = pixels[i + 1] = pixels[i + 2] = 0;
          }
  assert.equal(jsQR(pixels, w, w).data, managed[0].code);
  const temporary = {
    ...original,
    grades: [...original.grades, '試験学年'],
    classes: [...original.classes, '試験組'],
  };
  assert.equal((await adm('settings', { settings: temporary })).status, 200);
  const custom = await register({
    kind: 'student',
    grade: '試験学年',
    className: '試験組',
    number: 1,
  });
  assert.equal(custom.profile.grade, '試験学年');
  assert.equal(
    (
      await adm('participants', {
        id: custom.profile.id,
        action: 'edit',
        grade: '試験学年',
        className: '試験組',
        number: 2,
      })
    ).status,
    200,
  );
  assert.equal(
    (await req('/api/passport', { cookie: custom.cookie })).data.profile.number,
    2,
  );
  const csv = await fetch(base + '/api/admin/export', {
    headers: { cookie: adminCookie },
  });
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  assert.ok((await csv.text()).includes('試験学年'));
  assert.equal(
    (
      await adm('settings', {
        settings: { ...original, registrationOpen: false },
      })
    ).status,
    200,
  );
  assert.equal(
    (await req('/api/register', { data: { kind: 'guest' } })).status,
    409,
  );
  assert.equal((await adm('settings', { settings: original })).status, 200);
  assert.equal(
    (await adm('settings', { action: 'purge', confirm: 'wrong' })).status,
    400,
  );
  assert.equal(
    (
      await adm('participants', {
        id: student.profile.id,
        action: 'reset',
        confirm: 'スタンプをリセット',
      })
    ).status,
    200,
  );
  assert.deepEqual(
    (await req('/api/passport', { cookie: student.cookie })).data.stamps,
    [],
  );
  const maxGuest = guests.reduce((a, b) =>
    a.profile.guestNumber > b.profile.guestNumber ? a : b,
  );
  assert.equal(
    (
      await adm('participants', {
        id: maxGuest.profile.id,
        action: 'delete',
        confirm: '参加者を削除',
      })
    ).status,
    200,
  );
  tracked.splice(tracked.indexOf(maxGuest.profile.id), 1);
  const next = await register({ kind: 'guest' });
  assert.ok(next.profile.guestNumber > maxGuest.profile.guestNumber);
  console.log(
    'PASS: student enrollment/duplicates, 12 concurrent unique guest IDs/no reuse, profile isolation, 24 simultaneous stamps, completion/ranking, custom grade/class, admin edits/reset/delete/CSV, registration pause, protected APIs, CSRF, invalid QR, QR decoder.',
  );
} finally {
  if (adminCookie) {
    if (original) await adm('settings', { settings: original });
    for (const id of tracked)
      await adm('participants', {
        id,
        action: 'delete',
        confirm: '参加者を削除',
      });
    await adm('logout', {});
  }
}
