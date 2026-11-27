// 搜尋比對、地區建議、兩台裝置同時改的合併規則（純計算）
import { normText, matchRecord, snippet, CONTACT_FIELDS, CUSTOMER_FIELDS } from '../../src/lib/searchText.js'
import { suggestRegions, TW_REGIONS, canonicalRegion, regionCleanupGroups } from '../../src/lib/twRegions.js'
import { planSave } from '../../src/lib/editMerge.js'
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail = 1 }

// ── 寫法差異 ──
ok(normText('臺北') === normText('台北'), '臺北＝台北')
ok(normText('@Yu_ABC') === normText('yu_abc'), 'IG 的 @ 和大小寫不管')
ok(normText('ＡＢＣ１２３') === 'abc123', '全形英數字當半形')
ok(normText(' 大 安 ') === '大安', '空白不管')

// ── 互動名單 ──
const c = { name: '胡祐銘', occupation: '工程師', platform: 'IG', platform_account: 'hu_ming', region: '臺北市大安區', note: '社團認識', pain_point: '最近睡不好、容易累', asked_products: '愛尚它®綜合維生素粉末' }
ok(matchRecord(c, '胡', CONTACT_FIELDS).label === null, '名字找到：不用多一行說明')
ok(matchRecord(c, '工程', CONTACT_FIELDS).label === null, '職業找到：畫面上本來就看得到')
let h = matchRecord(c, '@HU_MING', CONTACT_FIELDS)
ok(h && h.label === 'IG' && h.value === 'hu_ming', 'IG 帳號找到，說明寫 IG：hu_ming')
h = matchRecord(c, '台北大安', CONTACT_FIELDS)
ok(h && h.label === '地區', '打「台北大安」也找得到臺北市大安區')
h = matchRecord(c, '台北', CONTACT_FIELDS)
ok(h && h.label === '地區', '打台北找到臺北市大安區')
ok(matchRecord(c, '社團', CONTACT_FIELDS).label === '備註', '備註')
ok(matchRecord(c, '睡', CONTACT_FIELDS).label === '痛點', '痛點')
ok(matchRecord(c, '愛尚它', CONTACT_FIELDS).label === '問過', '詢問過的產品')
ok(matchRecord(c, '韓國', CONTACT_FIELDS) === null, '都沒有就不符合')
ok(matchRecord(c, '', CONTACT_FIELDS) !== null, '沒打字：全部都算')
ok(snippet('這是一段很長很長的備註，裡面提到最近睡不好，還有其他很多很多的事情要記下來', '睡不好', 20).includes('睡不好'), '說明太長截短，找到的字留著')

// ── 顧客 ──
const k = { name: '黃先生', phone: '0912-345-678', occupation: '老師', address: '新北市板橋區文化路一段' }
ok(matchRecord(k, '0912345678', CUSTOMER_FIELDS).label === null, '電話不管中間的 -')
ok(matchRecord(k, '老師', CUSTOMER_FIELDS).label === null, '顧客職業')
h = matchRecord(k, '板橋', CUSTOMER_FIELDS)
ok(h && h.label === '地址', '顧客地址，說明寫地址')

// ── 地區建議 ──
ok(Object.keys(TW_REGIONS).length === 22 && Object.values(TW_REGIONS).reduce((a, b) => a + b.length, 0) === 368, '22 個縣市、368 個鄉鎮市區')
ok(JSON.stringify(suggestRegions('大安')) === JSON.stringify(['台北市大安區', '台中市大安區']), '大安 → 台北市大安區、台中市大安區')
ok(suggestRegions('臺北大安')[0] === '台北市大安區', '臺北大安 → 台北市大安區')
ok(suggestRegions('板橋')[0] === '新北市板橋區', '板橋 → 新北市板橋區')
const x = suggestRegions('新竹')
ok(x.includes('新竹市') && x.includes('新竹縣'), '新竹市和新竹縣都有（不會被當成同一個）')
ok(suggestRegions('新', ['新加坡'])[0] === '新加坡', '自己打過的排最前面')
ok(suggestRegions('東京').length === 0, '國外沒有建議，照打')
ok(suggestRegions('台北市大安區').length === 0, '已經打完整就不再跳')
ok(suggestRegions('台中').length <= 6, '最多 6 個')

// ── 舊地區寫法整理 ──
ok(canonicalRegion('台北大安') === '台北市大安區' && canonicalRegion('臺北市 大安區') === '台北市大安區', '台北大安、臺北市 大安區 → 台北市大安區')
ok(canonicalRegion('台北') === '台北市', '台北 → 台北市')
ok(canonicalRegion('大安區') === null && canonicalRegion('新竹') === null, '大安區（台北台中都有）、新竹（市和縣）分不出來：不改')
ok(canonicalRegion('日本東京') === null, '國外：不改')
const g = regionCleanupGroups(['台北大安', '台北市大安區', '台北市大安區', '台中市', '新加坡'])
ok(g.length === 1 && g[0].canonical === '台北市大安區' && g[0].total === 3, '只列出寫法不一致的那一組（台中市本來就一致不列）')

// ── 兩台裝置同時改 ──
const base = { name: '小美', note: '朋友', region: '', phone: '' }
let p = planSave(base, { ...base, note: '社團' }, { ...base, region: '台北市大安區' })
ok(p.mine.join() === 'note' && p.conflicts.length === 0, '我改備註、另一台改地區：只寫備註，不問')
p = planSave(base, { ...base, note: '社團' }, { ...base, note: '同事' })
ok(p.conflicts.join() === 'note', '兩邊都改備註、改得不一樣：要問')
p = planSave(base, { ...base, note: '社團' }, { ...base, note: '社團' })
ok(p.conflicts.length === 0, '兩邊改成一樣：不用問')
p = planSave(base, { ...base, name: ' 小美 ' }, base)
ok(p.mine.length === 0, '只多打空白不算改')
p = planSave(base, { ...base }, null)
ok(p.mine.length === 0 && p.conflicts.length === 0, '讀不到最新的也不出錯')
process.exit(fail)
