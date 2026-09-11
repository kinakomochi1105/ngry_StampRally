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
  const r = await req('/api/register', {
    data: { nickname: '文化祭参加者', ...data },
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.match(r.headers.get('set-cookie'), /HttpOnly/);
  const pass = await req('/api/passport', { cookie: r.cookie });
  tracked.push(pass.data.profile.id);
  return {
    cookie: r.cookie,
    profile: pass.data.profile,
    recoveryCode: r.data.recoveryCode,
  };
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
  const editorGuest = await register({ kind: 'guest' });
  const patch = {
    id: editorGuest.profile.id,
    action: 'stamp',
    spotId: managed[0].id,
    collected: true,
  };
  assert.equal(
    (
      await req('/api/admin/participants', {
        data: patch,
        cookie: editorGuest.cookie,
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await req('/api/admin/participants', {
        data: patch,
        cookie: adminCookie,
        origin: 'https://attacker.invalid',
      })
    ).status,
    403,
  );
  assert.equal(
    (await adm('participants', { ...patch, spotId: 'missing-location' }))
      .status,
    404,
  );
  assert.equal(
    (await adm('participants', { ...patch, collected: 'true' })).status,
    400,
  );
  assert.equal((await adm('participants', patch)).status, 200);
  const afterGrant = (
    await req('/api/passport', { cookie: editorGuest.cookie })
  ).data;
  assert.equal(afterGrant.stamps.length, 1);
  const originalTime = afterGrant.stamps[0].createdAt;
  assert.equal((await adm('participants', patch)).status, 200);
  assert.equal(
    (await req('/api/passport', { cookie: editorGuest.cookie })).data.stamps[0]
      .createdAt,
    originalTime,
  );
  const editorView = (await adm('participants?id=' + editorGuest.profile.id))
    .data;
  assert.equal(
    editorView.spots.find((s) => s.id === managed[0].id).collected,
    1,
  );
  const progress = (await adm('participants')).data.rows.find(
    (p) => p.id === editorGuest.profile.id,
  );
  assert.equal(progress.stampCount, 1);
  assert.ok(progress.ranking > 0);
  assert.equal(
    (await adm('participants', { ...patch, collected: false })).status,
    200,
  );
  assert.equal(
    (await req('/api/passport', { cookie: editorGuest.cookie })).data.stamps
      .length,
    0,
  );
  assert.equal(
    (await adm('participants?id=' + editorGuest.profile.id)).data.spots.find(
      (s) => s.id === managed[0].id,
    ).collected,
    0,
  );
  const audit = (await adm('settings')).data.logs;
  assert.ok(
    audit.some(
      (l) =>
        l.action === 'stamp_grant' &&
        l.target === String(editorGuest.profile.id) + ':' + managed[0].id,
    ),
  );
  assert.ok(audit.some((l) => l.action === 'stamp_revoke'));
  console.log(
    'PASS: admin individual stamp grant/revoke, idempotent timestamp, participant progress/rank, audit, authorization and CSRF.',
  );
  const studentInput = {
    nickname: '文化祭参加者',
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
  const studentPass = (await req('/api/passport', { cookie: student.cookie }))
    .data;
  assert.equal(studentPass.stamps.length, 1);
  assert.ok(Array.isArray(studentPass.traffic));
  const trafficPoint = studentPass.traffic.find(
    (point) => point.spotId === managed[0].id,
  );
  assert.ok(trafficPoint);
  assert.ok(trafficPoint.recentCount >= 24);
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
  // A nickname is not a secret. Both factors must match, and restore rotates the device session.
  assert.equal(
    (
      await req('/api/recovery/login', {
        data: { nickname: student.profile.nickname },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await req('/api/recovery/login', {
        data: { nickname: '別の名前', recoveryCode: student.recoveryCode },
      })
    ).status,
    401,
  );
  assert.equal(
    (await req('/api/recovery/setup', { data: { nickname: 'さくら' } })).status,
    401,
  );
  const beforeCookie = student.cookie;
  const restored = await req('/api/recovery/login', {
    data: {
      nickname: student.profile.nickname,
      recoveryCode: student.recoveryCode,
    },
  });
  assert.equal(restored.status, 200, JSON.stringify(restored.data));
  student.cookie = restored.cookie;
  assert.equal(
    (await req('/api/passport', { cookie: beforeCookie })).data.profile,
    null,
  );
  assert.equal(
    (
      await req('/api/stamp', {
        cookie: beforeCookie,
        data: { code: managed[0].code },
      })
    ).status,
    401,
  );
  const restoredPass = (await req('/api/passport', { cookie: student.cookie }))
    .data;
  assert.equal(restoredPass.profile.id, student.profile.id);
  assert.equal(restoredPass.stamps.length, managed.length);
  assert.equal(restoredPass.profile.recoveryHash, undefined);
  assert.equal(restoredPass.profile.recoveryCode, undefined);
  const renewed = await req('/api/recovery/setup', {
    cookie: student.cookie,
    data: {},
  });
  assert.equal(renewed.status, 200);
  assert.notEqual(renewed.data.recoveryCode, student.recoveryCode);
  assert.equal(
    (
      await req('/api/recovery/login', {
        data: {
          nickname: student.profile.nickname,
          recoveryCode: student.recoveryCode,
        },
      })
    ).status,
    401,
  );
  student.recoveryCode = renewed.data.recoveryCode;
  const again = await req('/api/recovery/login', {
    data: {
      nickname: student.profile.nickname,
      recoveryCode: student.recoveryCode.toLowerCase().replaceAll('-', ' '),
    },
  });
  assert.equal(again.status, 200);
  student.cookie = again.cookie;
  const logout = await req('/api/logout', { cookie: student.cookie, data: {} });
  assert.equal(logout.status, 200);
  assert.equal(
    (await req('/api/passport', { cookie: student.cookie })).data.profile,
    null,
  );
  const afterLogout = await req('/api/recovery/login', {
    data: {
      nickname: student.profile.nickname,
      recoveryCode: student.recoveryCode,
    },
  });
  assert.equal(afterLogout.status, 200);
  student.cookie = afterLogout.cookie;
  assert.equal(
    (await req('/api/passport', { cookie: student.cookie })).data.stamps.length,
    managed.length,
  );
  const guest = guests[0];
  const guestBefore = guest.cookie;
  const guestLogin = await req('/api/recovery/login', {
    data: {
      nickname: guest.profile.nickname,
      recoveryCode: guest.recoveryCode,
    },
  });
  assert.equal(guestLogin.status, 200);
  guest.cookie = guestLogin.cookie;
  assert.equal(
    (await req('/api/passport', { cookie: guest.cookie })).data.profile
      .guestNumber,
    guest.profile.guestNumber,
  );
  assert.equal(
    (await req('/api/passport', { cookie: guestBefore })).data.profile,
    null,
  );
  for (const nickname of [
    '',
    'a',
    'ＦＵＣＫ',
    'f-u-c-k',
    'セックス',
    'うんこさん',
    '管理者さん',
    '<script>',
    'a\u200Bb',
  ])
    assert.equal(
      (await req('/api/register', { data: { kind: 'guest', nickname } }))
        .status,
      400,
      'Rejected invalid nickname',
    );
  const nickConfig = { ...original, nicknameBlockedWords: ['禁止見本'] };
  assert.equal((await adm('settings', { settings: nickConfig })).status, 200);
  assert.equal(
    (
      await req('/api/register', {
        data: { kind: 'guest', nickname: '禁止見本さん' },
      })
    ).status,
    400,
  );
  assert.equal((await adm('settings', { settings: original })).status, 200);
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
    // Icons: a template key and a small PNG are kept; anything else is refused.
    assert.equal(
      (await adm('spots', { ...originalSpot, icon: 'trophy' })).status,
      200,
    );
    assert.equal(
      (await adm('spots')).data.spots.find((s) => s.id === originalSpot.id)
        .icon,
      'trophy',
    );
    const picture =
      'data:image/png;base64,' +
      Buffer.from('a'.repeat(600)).toString('base64');
    assert.equal(
      (await adm('spots', { ...originalSpot, icon: picture })).status,
      200,
    );
    assert.equal(
      (await adm('spots')).data.spots.find((s) => s.id === originalSpot.id)
        .icon,
      picture,
    );
    for (const icon of [
      'javascript:alert(1)',
      'data:text/html;base64,AAAA',
      'data:image/png;base64,' + 'A'.repeat(96000),
      'made-up-key',
    ])
      assert.equal(
        (await adm('spots', { ...originalSpot, icon })).status,
        400,
        icon.slice(0, 32),
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
  const pausedRestore = await req('/api/recovery/login', {
    data: {
      nickname: student.profile.nickname,
      recoveryCode: student.recoveryCode,
    },
  });
  assert.equal(pausedRestore.status, 200);
  student.cookie = pausedRestore.cookie;
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
  for (let i = 0; i < 11; i++) {
    const denied = await req('/api/recovery/login', {
      data: { nickname: '間違い', recoveryCode: student.recoveryCode },
    });
    assert.equal(denied.status, i < 10 ? 401 : 429);
  }
  console.log(
    'PASS: nickname rules/custom blocklist, recovery preserves stamps and IDs, wrong factors rejected, session revocation, code reissue, recovery throttle, student enrollment/duplicates, 12 concurrent unique guest IDs/no reuse, profile isolation, 24 simultaneous stamps, completion/ranking, custom grade/class, admin edits/reset/delete/CSV, registration pause, protected APIs, CSRF, invalid QR, QR decoder.',
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
