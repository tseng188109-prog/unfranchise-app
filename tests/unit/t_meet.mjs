import { pickMeet, rankMeet, whyOf, isResting, nextRest, sayFor, canPick } from '../../src/lib/meetPick.js'
let P = 0, F = 0; const ok = (c, m) => { if (c) P++; else { F++; console.log('FAIL', m) } }
const T = '2026-11-13' // 週五
const ctx0 = { lastMeet: {}, lastPlan: {}, sampleAt: {}, rest: {} }
const C = (id, x = {}) => ({ id, name: id, is_archived: false, source: null, egg_type: '荷包蛋', ...x })
// 1. 見過面還沒約下次
let ctx = { ...ctx0, lastMeet: { a: '2026-11-08' } }
ok(whyOf(C('a'), ctx, T).tier === 1 && whyOf(C('a'), ctx, T).text === '11/8 見過，還沒約下一次', 'tier1 text')
ctx = { ...ctx0, lastMeet: { a: '2026-11-08' }, lastPlan: { a: '2026-11-09' } }
ok(whyOf(C('a', { last_contact_date: '2026-11-09' }), ctx, T).tier !== 1, '見完已約下次 → 不是第一類')
ctx = { ...ctx0, lastMeet: { a: '2026-10-01' } }
ok(whyOf(C('a'), ctx, T).tier !== 1, '30 天前見的不算')
ok(whyOf(C('a'), { ...ctx0, lastMeet: { a: T } }, T).text === '今天才見過，趁還記得約下一次', '今天見')
// 2. 試用品
ok(whyOf(C('b'), { ...ctx0, sampleAt: { b: '2026-11-08' } }, T).tier === 3 && whyOf(C('b'), { ...ctx0, sampleAt: { b: '2026-11-08' } }, T).text === '試用品給了 5 天，問問用得怎樣', 'tier2')
ok(whyOf(C('b'), { ...ctx0, sampleAt: { b: '2026-11-12' } }, T).tier !== 3, '試用品才給 1 天不算')
// 3. 核桃
ok(whyOf(C('c', { need_level: '大四', last_contact_date: '2026-11-01' }), ctx0, T).tier === 2, '核桃第二 大四')
ok(whyOf(C('c', { interest_level: '很有興趣' }), ctx0, T).text === '他自己說想了解（很有興趣）', 'tier3 text')
ok(whyOf(C('c2'), { ...ctx0, lastPlan: { c2: '2026-11-01' }, lastBizPlan: { c2: { date: '2026-11-01', label: '一對一會談' } } }, T).text === '他答應聽一對一會談，趁熱約下一次', '答應聽一對一 → 核桃')
ok(whyOf(C('c3', { last_contact_date: '2026-10-20' }), { ...ctx0, lastPlan: { c3: '2026-11-01' } }, T).tier === 5, '只約過吃飯 → 不是核桃')
// 4. 最近聊過
ok(whyOf(C('d', { last_contact_date: '2026-11-11' }), ctx0, T).text === '前天才聊過，趁熱約', 'tier4 前天')
ok(whyOf(C('d', { last_contact_date: T }), ctx0, T).text === '今天才聊過，趁熱約', 'tier4 今天')
ok(whyOf(C('d', { last_contact_date: '2026-11-06' }), ctx0, T).text === '7 天前聊過，趁熱約', 'tier4 7 天')
ok(whyOf(C('d', { last_contact_date: '2026-11-05' }), ctx0, T).tier === 5, '8 天前 → 輪流')
// 5 / 生雞蛋
ok(whyOf(C('e', { egg_type: '生雞蛋', last_contact_date: T }), ctx0, T) === null, '生雞蛋不推薦')
ok(whyOf(C('e', { egg_type: null }), ctx0, T).tier === 5, '熟悉度沒填也輪得到')
ok(whyOf(C('e', { egg_type: '茶葉蛋', last_contact_date: '2026-10-20' }), ctx0, T).text.includes('很熟了'), '茶葉蛋說法')
// 不推薦的人
ok(!canPick(C('f', { is_muted: true }), ctx0, T), '時機未到')
ok(!canPick(C('f', { next_plan: '一對一', next_plan_date: '2026-11-20' }), ctx0, T), '已約好')
ok(canPick(C('f', { next_plan: '一對一', next_plan_date: '2026-11-01' }), ctx0, T), '約的日子已過可以再推')
ok(!canPick(C('f', { invite_cool_until: '2026-11-15' }), ctx0, T), '剛邀過沒約成')
ok(!canPick(C('f', { referral_stage: '暫時婉拒' }), ctx0, T), '暫時婉拒')
ok(!canPick(C('f', { interest_level: '沒興趣', last_contact_date: '2026-11-01' }), ctx0, T), '沒興趣 30 天內')
// 休息 3 天
ok(!isResting({ x: T }, 'x', T), '今天推薦的今天照樣推')
ok(isResting({ x: '2026-11-12' }, 'x', T) && isResting({ x: '2026-11-10' }, 'x', T), '1~3 天前推薦過 → 休息')
ok(!isResting({ x: '2026-11-09' }, 'x', T), '4 天前推薦過 → 可以再出現')
const nr = nextRest({ old: '2026-11-01', y: '2026-11-11' }, 'z', T)
ok(!('old' in nr) && nr.y === '2026-11-11' && nr.z === T, '清掉過期的休息紀錄')
// 排序：第一類優先，首選 10 在同類先
const list = [C('w', { last_contact_date: '2026-11-12' }), C('m'), C('t', { last_contact_date: '2026-11-12', is_top10: true }), C('n', { last_contact_date: '2026-11-12' })]
ctx = { ...ctx0, lastMeet: { m: '2026-11-10' } }
const rk = rankMeet(list, ctx, T)
ok(rk[0].id === 'm' && rk[1].id === 't', '見過面最前，首選 10 在同類先 ' + rk.map(r => r.id))
// 換一位：先換到不同來源
const p1 = pickMeet(list, ctx, T, ['m'])
ok(p1 && p1.pickWhy.tier !== 1, '換一位換到不同來源')
const many = [C('m'), C('m2'), C('w', { last_contact_date: '2026-11-12' })]
const p2 = pickMeet(many, { ...ctx0, lastMeet: { m: '2026-11-10', m2: '2026-11-11' } }, T, ['m'])
ok(p2.id === 'w', '同類還有人也先換到別類 ' + p2.id)
ok(pickMeet(many, { ...ctx0, lastMeet: { m: '2026-11-10', m2: '2026-11-11' } }, T, ['m', 'w']).id === 'm2', '別類沒人了才換同類')
// 每天輪流：一堆同類的人，不同天推薦不同人，休息會換人
const pool = Array.from({ length: 30 }, (_, i) => C('p' + i, { last_contact_date: '2026-09-01' }))
const days = ['2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17']
const picks = days.map(d => pickMeet(pool, ctx0, d).id)
ok(new Set(picks).size >= 4, '一般名單每天會換人 ' + picks)
let rest = {}; const seq = []
days.forEach(d => { const p = pickMeet(pool, { ...ctx0, rest }, d); seq.push(p.id); rest = nextRest(rest, p.id, d) })
ok(seq.slice(0, 4).every((x, i, a) => a.indexOf(x) === i), '推薦過沒約，3 天內不會再出現 ' + seq)
// 只有一位：休息完會回來
rest = { solo: '2026-11-12' }
ok(pickMeet([C('solo', { last_contact_date: '2026-11-12' })], { ...ctx0, rest }, T).id === 'solo', '名單只有他、他在休息 → 還是推薦他')
ok(pickMeet([C('solo', { last_contact_date: '2026-11-12' }), C('two', { last_contact_date: '2026-11-12' })], { ...ctx0, rest }, T).id === 'two', '有別人時先推別人')
// 說法：給兩個時間（週五 → 週六下午、週日晚上）
ok(sayFor(4, T).includes('週六下午還是週日晚上'), '說法給兩個時間 ' + sayFor(4, T))
ok(sayFor(1, T).includes('你最喜歡的是哪部分'), '見過面的說法')
// 顧客、夥伴不會是核桃
ok(whyOf(C('g', { source: 'customer', interest_level: '很有興趣' }), ctx0, T).tier !== 2, '顧客不是核桃')
ok(whyOf(C('h'), { ...ctx0, lastMeet: { h: { date: '2026-11-10', tool: '一對一會談' } } }, T).text === '11/10 一對一會談後，還沒約下一次', '一對一會談後')
ok(whyOf(C('h'), { ...ctx0, lastMeet: { h: { date: T, tool: '三方通話' } } }, T).text === '今天三方通話完，趁還記得約下一次', '今天三方通話')
ok(whyOf(C('h'), { ...ctx0, lastMeet: { h: { date: '2026-11-10', tool: null } } }, T).text === '11/10 見過，還沒約下一次', '見完了記一下（沒工具）')
ok(whyOf(C('h', { interest_level: '很有興趣' }), { ...ctx0, lastMeet: { h: { date: '2026-11-10', tool: '二對一會談' } } }, T).tier === 1, '聽過說明的核桃 → 還是第一類')
const rk2 = rankMeet([C('s1'), C('w9', { interest_level: '有點興趣' })], { ...ctx0, sampleAt: { s1: '2026-11-05' } }, T)
ok(rk2[0].id === 'w9' && rk2[1].id === 's1', '核桃在試用品前面')
ok(sayFor(2, T).includes('你上次說想多了解') && sayFor(3, T).includes('試用品用起來'), '說法跟著新順序')
console.log('t_meet PASS', P, 'FAIL', F)
