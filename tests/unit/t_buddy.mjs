// 搭檔連勝、打氣推播要不要送、晚上提醒的搭檔那一句
import * as B from '../../src/lib/buddy.js'
import { addDays } from '../../src/lib/rhythm.js'
import { skipReason, nightTime } from '../../api/cheer.js'
import { buddyLineFor } from '../../api/send-reminders.js'
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail = 1 }
const S = a => new Set(a)
const range = (from, n) => Array.from({ length: n }, (_, i) => addDays(from, i))

// 稱號
ok(B.titleOf(6) === null && B.titleOf(7) === '連勝新秀' && B.titleOf(13) === '連勝新秀' && B.titleOf(14) === '黃金搭檔', '稱號 7、14')
ok(B.titleOf(30) === '王牌組合' && B.titleOf(50) === '巔峰雙星' && B.titleOf(100) === '百日傳奇' && B.titleOf(400) === '百日傳奇', '稱號 30、50、100')
ok(B.nextTitleOf(29).n === 30 && B.nextTitleOf(29).title === '王牌組合' && B.nextTitleOf(100) === null, '下一個稱號')
ok(B.unlockedAt(14) === '黃金搭檔' && B.unlockedAt(15) === null, '剛好解鎖')

// 兩個人都做才算
const start = '2026-11-01', today = '2026-11-12'
const all = range(start, 12)
let s = B.pairStreak(S(all), S(all), start, today)
ok(s.count === 12 && s.meToday && s.otherToday, '兩人都每天做 → 12 ' + s.count)
s = B.pairStreak(S(all), S(all.slice(0, 11)), start, today)
ok(s.count === 11 && s.meToday && !s.otherToday, '他今天還沒做 → 不算斷 ' + s.count)
// 他 11/8 沒做：用掉那週的休息日，不斷，但那天不加
s = B.pairStreak(S(all), S(all.filter(d => d !== '2026-11-08')), start, today)
ok(s.count === 11, '一人漏一天 → 休息日守住 ' + s.count)
// 同一週兩人各漏一天（11/9 我、11/11 他）→ 11/11 用掉休息日，11/9 斷：只剩 11/10、11/12 兩天
s = B.pairStreak(S(all.filter(d => d !== '2026-11-09')), S(all.filter(d => d !== '2026-11-11')), start, today)
ok(s.count === 2, '同一週漏兩天 → 從頭算 ' + s.count)
// 成為搭檔之前做的不算
s = B.pairStreak(S(range('2026-10-20', 24)), S(range('2026-10-20', 24)), '2026-11-10', today)
ok(s.count === 3, '從成為搭檔那天開始算 ' + s.count)
// 今天剛成為搭檔、還沒人做
s = B.pairStreak(S(range('2026-11-01', 11)), S(range('2026-11-01', 11)), today, today)
ok(s.count === 0, '今天剛成為搭檔 → 0 ' + s.count)
// 最高紀錄
const broken = all.filter(d => d !== '2026-11-09' && d !== '2026-11-11')
// 11/1–11/8 都做、11/9 休息日、11/10 再做 → 那時是 9 天；11/11 斷掉
ok(B.pairBest(S(broken), S(all), start, today) === 9, '最高紀錄 9 天 ' + B.pairBest(S(broken), S(all), start, today))
// 這段連勝從哪天開始
ok(B.runStart(S(all), today, 12) === '2026-11-01', '連勝起點')
ok(B.runStart(S(all), today, 0) === null, '沒有連勝沒有起點')
// 邀請過期
ok(!B.inviteExpired(new Date(Date.now() - 6 * 86400000).toISOString()) && B.inviteExpired(new Date(Date.now() - 8 * 86400000).toISOString()), '邀請 7 天過期')

// 打氣推播
const now = new Date('2026-11-20T03:00:00Z') // 台北 11:00
const fresh = { created_at: '2026-11-20T02:59:00Z', pushed_at: null }
ok(skipReason({ cheer: fresh, tagSettings: {}, now }) === null, '白天、預設開 → 送')
ok(skipReason({ cheer: fresh, tagSettings: { notify: { cheer: false } }, now }) === 'off', '關掉隊友打氣 → 不送')
ok(skipReason({ cheer: fresh, tagSettings: { notify: { quietUntil: '2026-11-25' } }, now }) === 'quiet', '安靜模式 → 不送')
ok(skipReason({ cheer: { ...fresh, pushed_at: 'x' }, tagSettings: {}, now }) === 'already', '送過不再送')
ok(skipReason({ cheer: fresh, tagSettings: {}, now: new Date('2026-11-20T03:30:00Z') }) === 'too-old', '超過 10 分鐘不送')
ok(skipReason({ cheer: { created_at: '2026-11-20T14:59:00Z' }, tagSettings: {}, now: new Date('2026-11-20T15:00:00Z') }) === 'night', '台北 23:00 不送')
ok(nightTime(22) && nightTime(6) && !nightTime(7) && !nightTime(21), '晚上 10 點到早上 7 點')

// 晚上提醒的搭檔那一句
const A = 'a', Bb = 'b', C = 'c'
const buddies = [{ a: A, b: Bb, start_day: start }, { a: C, b: A, start_day: start }]
const act = { [A]: S(all.slice(0, 11)), [Bb]: S(all), [C]: S(all.slice(0, 11)) }
ok(buddyLineFor(A, buddies, act, { b: '致', c: '沈' }, today) === '致今天已經行動了，你也做一件事，連勝就到 12 天', '搭檔做了、我還沒 → 提醒 ' + buddyLineFor(A, buddies, act, { b: '致', c: '沈' }, today))
ok(buddyLineFor(A, buddies, { ...act, [A]: S(all) }, { b: '致' }, today) === null, '我已經做了 → 不提醒')
ok(buddyLineFor(A, buddies, { ...act, [Bb]: S(all.slice(0, 11)) }, { b: '致' }, today) === null, '搭檔也還沒做 → 不提醒')
ok(buddyLineFor('z', buddies, act, {}, today) === null, '沒有搭檔 → 不提醒')

process.exit(fail)
