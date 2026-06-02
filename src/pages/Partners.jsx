import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

function avatarBg(name) {
  const colors = ['#F97316','#3B82F6','#22C55E','#A855F7','#EC4899','#14B8A6']
  let n = 0; for (let i = 0; i < (name||'').length; i++) n += name.charCodeAt(i)
  return colors[n % colors.length]
}

function formatDate(d) {
  if (!d) return ''
  const dt = new Date(d)
  return `${dt.getFullYear()}/${String(dt.getMonth()+1).padStart(2,'0')}`
}

function todayTW() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
}

export default function Partners() {
  const [user, setUser] = useState(null)
  const [partners, setPartners] = useState([])
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  useEffect(() => { if (user) fetchPartners() }, [user])

  async function fetchPartners() {
    setLoading(true)

    const { data: partnerUsers } = await supabase
      .from('users')
      .select('id,name,created_at')
      .eq('referrer_id', user.id)

    if (partnerUsers && partnerUsers.length > 0) {
      const now = new Date()
      const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
      const todayDay = parseInt(todayTW().split('-')[2])

      const enriched = await Promise.all(partnerUsers.map(async p => {
        // 用 security definer function 查 BV/IBV
        const { data: bvData } = await supabase.rpc('get_partner_monthly_bv', {
          partner_id: p.id,
          month_start: monthStart,
        })
        const bv = bvData?.[0]?.bv || 0
        const ibv = bvData?.[0]?.ibv || 0

        // 用 security definer function 查打卡率
        const { data: checkinData } = await supabase.rpc('get_partner_checkin_rate', {
          partner_id: p.id,
          month_start: monthStart,
          today_day: todayDay,
        })
        const checkinRate = Number(checkinData) || 0

        // 直屬夥伴數
        const { count } = await supabase.from('users')
          .select('id', { count:'exact', head:true }).eq('referrer_id', p.id)

        const bvRate = Math.min(100, Math.round((bv / 1500) * 100))
        const ibvRate = Math.min(100, Math.round((ibv / 300) * 100))
        const isActive = bvRate >= 30 || checkinRate >= 50

        return { ...p, bv, ibv, bvRate, ibvRate, checkinRate, directCount: count||0, isActive }
      }))

      setPartners(enriched)
    } else {
      setPartners([])
    }

    // 待確認串聯
    const { data: pendingData } = await supabase
      .from('users')
      .select('id,name,created_at')
      .ilike('referrer_email_pending', user.email)

    setPending(pendingData || [])
    setLoading(false)
  }

  async function confirmPartner(partnerId) {
    await supabase.from('users').update({
      referrer_id: user.id,
      referrer_email_pending: null,
    }).eq('id', partnerId)
    fetchPartners()
  }

  return (
    <div style={{ background:'#F8FAFC',minHeight:'100vh',paddingBottom:80 }}>
      <div style={{ background:'linear-gradient(135deg,#1E3A5F,#2563EB)',
        padding:'52px 20px 20px' }}>
        <h1 style={{ fontSize:20,fontWeight:800,color:'#fff',margin:0 }}>我的夥伴</h1>
        <p style={{ fontSize:13,color:'#93C5FD',margin:'4px 0 0' }}>
          直屬 {partners.length} 人
        </p>
      </div>

      <div style={{ padding:'12px 16px',display:'flex',flexDirection:'column',gap:10 }}>
        {loading ? (
          <div style={{ textAlign:'center',padding:40,color:'#9CA3AF' }}>載入中…</div>
        ) : partners.length === 0 && pending.length === 0 ? (
          <div style={{ textAlign:'center',padding:60,color:'#9CA3AF' }}>
            <p style={{ fontSize:36,margin:'0 0 12px' }}>👥</p>
            <p style={{ fontSize:15 }}>還沒有直屬夥伴，邀請夥伴加入並填寫你的 Email</p>
          </div>
        ) : (
          <>
            {partners.map(p => (
              <div key={p.id} style={{ background:'#fff',borderRadius:14,padding:14,
                boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }}>
                <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:12 }}>
                  <div style={{ width:44,height:44,borderRadius:'50%',
                    background:avatarBg(p.name||'?'),
                    display:'flex',alignItems:'center',justifyContent:'center',
                    color:'#fff',fontWeight:700,fontSize:17,flexShrink:0 }}>
                    {(p.name||'?')[0]}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                      <span style={{ fontSize:15,fontWeight:700,color:'#111827' }}>
                        {p.name||'未命名'}
                      </span>
                      <span style={{ fontSize:11,fontWeight:700,padding:'2px 7px',
                        borderRadius:99,
                        background:p.isActive?'#DCFCE7':'#FEF9C3',
                        color:p.isActive?'#16A34A':'#CA8A04' }}>
                        {p.isActive?'活躍':'待關注'}
                      </span>
                    </div>
                    <p style={{ fontSize:12,color:'#9CA3AF',margin:'2px 0 0' }}>
                      加入 {formatDate(p.created_at)} · 直屬 {p.directCount} 人
                    </p>
                  </div>
                </div>

                <div style={{ display:'flex',gap:8 }}>
                  {[
                    { label:'BV達成', value:p.bvRate, color:'#F97316' },
                    { label:'IBV達成', value:p.ibvRate, color:'#3B82F6' },
                    { label:'打卡率', value:p.checkinRate, color:'#22C55E' },
                  ].map(m => (
                    <div key={m.label} style={{ flex:1,background:'#F8FAFC',
                      borderRadius:10,padding:'8px',textAlign:'center' }}>
                      <p style={{ fontSize:11,color:'#9CA3AF',margin:'0 0 4px',fontWeight:600 }}>
                        {m.label}
                      </p>
                      <p style={{ fontSize:16,fontWeight:800,color:m.color,margin:0 }}>
                        {m.value}%
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {pending.length > 0 && (
              <div style={{ background:'#FFF7ED',borderRadius:14,padding:14,
                border:'1px solid #FED7AA' }}>
                <p style={{ fontSize:13,fontWeight:700,color:'#F97316',margin:'0 0 10px' }}>
                  待確認串聯
                </p>
                {pending.map(p => (
                  <div key={p.id} style={{ display:'flex',alignItems:'center',
                    justifyContent:'space-between',padding:'8px 0',
                    borderBottom:'1px solid #FED7AA' }}>
                    <div>
                      <p style={{ fontSize:14,color:'#374151',margin:0,fontWeight:600 }}>
                        {p.name || '未命名'}
                      </p>
                      <p style={{ fontSize:12,color:'#9CA3AF',margin:'2px 0 0' }}>
                        填了你的 email 申請加入
                      </p>
                    </div>
                    <button onClick={() => confirmPartner(p.id)}
                      style={{ padding:'7px 14px',borderRadius:9,border:'none',
                        background:'#F97316',color:'#fff',fontWeight:700,
                        fontSize:13,cursor:'pointer' }}>確認</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}