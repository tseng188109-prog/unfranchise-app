// 戰隊排名共用工具：Team.jsx 跟 Dashboard.jsx 都從這裡 import
// 原因：本週打卡天數／連續天數的計算方式如果兩邊各自維護一份，
// 未來規則一改忘記同步，兩個畫面顯示的名次就會兜不起來。
import { supabase } from '../supabase'

export function toDateStr(d) {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
}
export function today() { return toDateStr(new Date()) }

// 本週週一到週日的日期陣列
export function getWeekDays() {
  const d = new Date()
  const dow = d.getDay()
  const diff = (dow + 1) % 7
  const start = new Date(d)
  start.setDate(d.getDate() - diff)
  const days = []
  for (let i = 0; i < 7; i++) {
    const day = new Date(start)
    day.setDate(start.getDate() + i)
    days.push(toDateStr(day))
  }
  return days
}

// 取得使用者目前所屬戰隊，沒有加入任何戰隊回傳 null
export async function fetchMyTeam(userId) {
  const { data: membership } = await supabase
    .from('team_members').select('team_id').eq('user_id', userId).maybeSingle()
  if (!membership) return null
  const { data: teamData } = await supabase
    .from('teams').select('*').eq('id', membership.team_id).single()
  return teamData || null
}

// 計算戰隊成員本週打卡排名：只算排名需要的欄位
// （dayMap / todayChecked / weekCheckinDays / streak），已依打卡天數→連續天數排序。
// BV/IBV/週行動等展示用欄位不在這裡算，各頁面自己另外查、依 user_id merge 回來，
// 避免這支共用函式扛不需要的查詢，也讓排名邏輯保持單一事實來源。
export async function fetchTeamRanking(teamId, weekDays) {
  const { data: memberRows } = await supabase
    .from('team_members').select('user_id,joined_at').eq('team_id', teamId)
    .order('joined_at', { ascending: true })
  if (!memberRows) return []

  const userIds = memberRows.map(m => m.user_id)

  const { data: userProfiles } = await supabase
    .from('users').select('id,name').in('id', userIds)
  const nameMap = {}
  ;(userProfiles||[]).forEach(u => { nameMap[u.id] = u.name })

  const { data: checkins } = await supabase
    .from('daily_checkins').select('user_id,date,is_done')
    .in('user_id', userIds).in('date', weekDays)

  const todayStr = today()
  const todayIdx = weekDays.indexOf(todayStr)

  const result = memberRows.map(m => {
    const myCheckins = (checkins||[]).filter(c => c.user_id === m.user_id)

    const dayMap = {}
    weekDays.forEach(d => {
      dayMap[d] = myCheckins.some(c => c.date === d && c.is_done)
    })

    const todayChecked = dayMap[todayStr] || false
    const weekCheckinDays = Object.values(dayMap).filter(Boolean).length

    let streak = 0
    for (let i = todayIdx; i >= 0; i--) {
      if (dayMap[weekDays[i]]) streak++
      else break
    }

    return {
      user_id: m.user_id,
      name: nameMap[m.user_id] || '未命名',
      joined_at: m.joined_at,
      dayMap, todayChecked, weekCheckinDays, streak,
    }
  })

  result.sort((a,b) => {
    if (b.weekCheckinDays !== a.weekCheckinDays) return b.weekCheckinDays - a.weekCheckinDays
    return b.streak - a.streak
  })
  return result
}
