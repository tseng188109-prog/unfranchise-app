// 分享圖卡、你的細節、給帶領者的報告共用的「行動、成果」算法（純計算）
import { computeActions, dayDots, computeResults, resultTiles, pickHighlight, pathOf, pathSummary, groupPeople } from '../../src/lib/results.js'
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail = 1 }

const days = ['2026-11-21', '2026-11-22', '2026-11-23']
const mode = { talk: 3, meet: 1, fresh: 2 }

// ── 行動 ──
const logs = [
  { contact_id: 'a', date: '2026-11-21' }, { contact_id: 'a', date: '2026-11-21' }, { contact_id: 'b', date: '2026-11-21' }, { contact_id: 'c', date: '2026-11-21', kind: 'meet_plan' },
  { contact_id: 'd', date: '2026-11-22', kind: 'invite_wait' },
  { contact_id: 'x', date: '2026-11-30' },
]
const added = [{ day: '2026-11-21' }, { day: '2026-11-21' }, { day: '2026-11-22' }, { day: '2026-12-01' }]
const act = computeActions({ days, logs, unplanned: [{ contact_id: 'e', date: '2026-11-23' }], added })
ok(act.talk === 4, '互動人次：同一個人同一天只算一次（11/21 三位＋11/22 一位）')
ok(act.asks === 3, '開口邀約：約成、等回覆、直接見面補記都算')
ok(act.fresh === 3, '新名單只算日期裡面的')
const dots = dayDots(days, act.perDay, mode, ['2026-11-23'])
ok(dots[0].s === 'full', '11/21 互動 3、邀約 1、新名單 2：做滿')
ok(dots[1].s === 'part', '11/22 有行動沒做滿')
ok(dots[2].s === 'part', '11/23 只有直接見面補記：算有行動')
ok(dayDots(['2026-11-24'], { '2026-11-24': { talk: new Set(), plan: 0, fresh: 0 } }, mode)[0].s === 'rest', '什麼都沒做：休息')

// ── 成果 ──
const from = '2026-11-21', to = '2026-11-27'
const r = computeResults({
  from, to,
  planLogs: [
    { contact_id: 'p1', date: '2026-11-24', note: '11/26 14:00 二對一會談', contacts: { name: '林小美' } },
    { contact_id: 'p1', date: '2026-11-22', note: '一對一會談', contacts: { name: '林小美' } },
    { contact_id: 'p2', date: '2026-11-25', note: '家庭事業說明會', contacts: { name: '王大明' } },
    { contact_id: 'p3', date: '2026-11-25', note: '約聚餐', contacts: { name: '陳小姐' } },
    { contact_id: 'p4', date: '2026-11-20', note: '事業說明會', contacts: { name: '日期外' } },
  ],
  meets: [
    { contact_id: 'p1', date: '2026-11-26', note: '14:00 二對一會談', contacts: { name: '林小美' } },
    { contact_id: 'p3', date: '2026-11-26', note: '約聚餐', contacts: { name: '陳小姐' } },
    { contact_id: 'p5', date: '2026-11-23', note: null, contacts: { name: '直接見' } },
  ],
  trials: [{ contact_id: 't1', steps: { 1: '2026-11-22', 3: '2026-11-25', 4: '2026-11-27' } }, { contact_id: 't2', steps: { 1: '2026-10-01' } }],
  names: { t1: '試做者' },
  homeLists: [{ id: 'k1', name: '老顧客', home_list_given_on: '2026-11-23' }],
  newCusts: [{ id: 'k2', name: '新顧客甲', day: '2026-11-24' }],
  tx: [
    { date: '2026-11-22', type: 'BV', points: 85, customer_id: 'k2', product_name: '愛尚它®每日精選組合隨身包' },
    { date: '2026-11-23', type: 'IBV', points: 12.5, customer_id: null, product_name: '自己買' },
    { date: '2026-11-19', type: 'BV', points: 999 },
  ],
  custNames: { k2: '新顧客甲' },
})
ok(r.met.length === 3, '已見面：按了見完了的都算（3 次）')
ok(r.met[1].label === '二對一會談' || r.met.some(m => m.label === '二對一會談'), '已見面的內容去掉時間')
ok(r.bizPlanned.length === 2, '邀約評估事業：林小美、王大明（約聚餐、日期外的不算；同一位只算一次）')
ok(r.bizPlanned.find(p => p.id === 'p1').label === '二對一會談', '同一位約了兩次：留最後一次')
ok(r.bizMet.length === 1 && r.bizMet[0].name === '林小美', '已評估事業：見完了而且是評估事業的內容')
ok(r.surveyPeople === 2 && r.survey.length === 4, '已給問卷或購物清單：試做者三步、老顧客一步，人數只算 2 位')
ok(r.survey.some(x => x.what === '三天問卷做完、跟進了' && x.date === '2026-11-25'), '試做第 3 步：寫成「三天問卷做完、跟進了」')
ok(r.newCust.length === 1, '新顧客 1 位')
ok(r.bv === 85 && r.ibv === 12.5, 'BV、IBV 只算日期裡面的')
ok(r.bvLines.length === 2 && r.bvLines[0].name === '新顧客甲', 'BV 細節寫出是哪位顧客')

const tiles = resultTiles(r)
ok(tiles.map(t => t.key).join() === 'met,bizPlanned,bizMet,survey,newCust,bv,ibv', '成果格子照順序')
ok(!resultTiles(r, { showBv: false }).some(t => t.key === 'bv' || t.key === 'ibv'), 'BV、IBV 開關關掉：圖片不放')
const empty = computeResults({ from, to })
ok(resultTiles(empty).length === 0, '都沒有成果：沒有格子（圖片改寫一句話）')

// ── 亮點 ──
const z = { met: 0, bizPlanned: 0, bizMet: 0, survey: 0, newCust: 0, bv: 0, ibv: 0, fresh: 0, asks: 0, talk: 0 }
ok(pickHighlight({ cur: { ...z, bizPlanned: 2, fresh: 6 }, prev: { ...z, fresh: 3, talk: 9 }, len: 7, activeDays: 5 }) === '邀約評估事業 2 位，比前 7 天多 2 位。', '成果變多：先講成果')
ok(pickHighlight({ cur: { ...z, fresh: 8, talk: 28 }, prev: { ...z, fresh: 5 }, len: 7, activeDays: 7 }) === '7 天每天都有行動，新名單 8 位。', '沒有成果變多、每天都有行動')
ok(pickHighlight({ cur: { ...z, fresh: 8 }, prev: { ...z, fresh: 5 }, len: 7, activeDays: 4 }) === '新名單 8 位，比前 7 天多 3 位。', '行動變多')
ok(pickHighlight({ cur: { ...z, bizPlanned: 1 }, prev: null, len: 5, activeDays: 2 }) === '這 5 天邀約評估事業 1 位。', '剛開始用，沒有前一段可以比：不比較')
ok(pickHighlight({ cur: { ...z, talk: 3 }, prev: { ...z, talk: 9 }, len: 7, activeDays: 2 }) === '這 7 天有 2 天有行動。', '比上一段少：只講做到的，不說變少')
ok(pickHighlight({ cur: z, prev: z, len: 3, activeDays: 0 }) === '', '什麼都沒做：沒有亮點')
ok(pickHighlight({ cur: { ...z, bv: 120 }, prev: { ...z, bv: 80, talk: 1 }, len: 7, activeDays: 1 }) === 'BV 120，比前 7 天多 40。', 'BV 不加單位')

// ── 怎麼走到這一步 ──
const path = pathOf({
  person: { id: 'p1', date: '2026-11-24', label: '二對一會談' },
  logs: [
    { date: '2026-11-02', note: '回覆限動' }, { date: '2026-11-10', note: '私訊' }, { date: '2026-11-20', note: '回覆限動', tool: null },
    { date: '2026-11-15', kind: 'invite_no', note: '邀了沒約成' }, { date: '2026-11-24', kind: 'meet_plan', note: '二對一會談' },
    { date: '2026-11-28', note: '之後的' },
  ],
  addedOn: '2026-10-30', metOn: '2026-11-26',
})
ok(path.talks === 3, '約成之前互動 3 次（邀約紀錄和之後的不算）')
ok(path.days === 25, '加入名單到約成 25 天')
ok(path.steps.map(s => s.text).join('|') === '加入名單|互動 3 次，第一次是「回覆限動」|之前邀過 1 次|約成二對一會談|見完了', '路徑照日期排')
ok(pathSummary([path, { talks: 5, days: null }]).join('|') === '平均互動了 4 次才約到|從加入名單到約到，平均 25 天', '整理：平均互動次數、平均天數（沒有加入日期的不算天數）')
ok(pathSummary([]).length === 0, '沒有人：不整理')

// ── 報告分組 ──
const g = groupPeople([
  { id: 1, name: 'A', egg: '生雞蛋', hasNext: true, inv: { kind: 'invite_wait' } },
  { id: 2, name: 'B', egg: '荷包蛋', inv: { kind: 'invite_wait' } },
  { id: 3, name: 'C', egg: '茶葉蛋', inv: { kind: 'invite_no' } },
  { id: 4, name: 'D', egg: '生雞蛋', inv: null },
  { id: 5, name: 'E', egg: '茶葉蛋', inv: { kind: 'meet_plan' } },
  { id: 6, name: 'F', egg: '', inv: null },
])
ok(g.next.map(p => p.name).join() === 'A', '有約好下一次：最前面（就算之前等回覆）')
ok(g.wait.map(p => p.name).join() === 'B' && g.no.map(p => p.name).join() === 'C', '等回覆、沒約成各一組')
ok(g.eggs.map(e => `${e.egg || '未'}:${e.list.map(p => p.name).join('')}`).join(' ') === '茶葉蛋:E 生雞蛋:D 未:F', '還在變熟：照茶葉蛋、荷包蛋、生雞蛋、還沒分類排')

console.log(fail ? 'FAIL' : 'ALL PASS')
process.exit(fail)
