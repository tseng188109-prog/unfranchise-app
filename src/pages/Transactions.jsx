import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'

function avatarBg(name) {
  const colors = ['#F97316','#3B82F6','#22C55E','#A855F7','#EC4899','#14B8A6']
  let n = 0; for (let i = 0; i < name.length; i++) n += name.charCodeAt(i)
  return colors[n % colors.length]
}

function formatDate(d) {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return `${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')}`
}

export default function Transactions() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [bvTotal, setBvTotal] = useState(0)
  const [ibvTotal, setIbvTotal] = useState(0)
  const [profit, setProfit] = useState(0)
  const [giftCost, setGiftCost] = useState(0)
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  useEffect(() => { if (user) fetchData() }, [user, year, month])

  async function fetchData() {
    setLoading(true)
    const start = `${year}-${String(month).padStart(2,'0')}-01`
    const end = new Date(year, month, 0).toISOString().split('T')[0]

    const { data } = await supabase
      .from('transactions')
      .select('*,customers(name)')
      .eq('user_id', user.id)
      .gte('date', start).lte('date', end)
      .order('date', { ascending: false })

    if (!data) { setLoading(false); return }

    setTransactions(data)
    let bv=0, ibv=0, p=0, gc=0
    data.forEach(t => {
      if (t.type==='BV') bv += Number(t.points)
      if (t.type==='IBV') ibv += Number(t.points)
      if (t.is_gift) gc += (t.cost || 0)
      else p += (t.amount||0) - (t.cost||0)
    })
    setBvTotal(bv); setIbvTotal(ibv); setProfit(p); setGiftCost(gc)
    setLoading(false)
  }

  function prevMonth() {
    if (month === 1) { setYear(y => y-1); setMonth(12) }
    else setMonth(m => m-1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y+1); setMonth(1) }
    else setMonth(m => m+1)
  }

  return (
    <div style={{ background:'#F8FAFC',minHeight:'100vh',paddingBottom:80 }}>
      {/* Header */}
      <div style={{ background:'#fff',padding:'52px 16px 16px',borderBottom:'1px solid #F3F4F6' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
          <h1 style={{ fontSize:20,fontWeight:800,color:'#111827',margin:0 }}>業績紀錄</h1>
          <button onClick={() => navigate('/transactions/new')}
            style={{ width:36,height:36,borderRadius:'50%',background:'#2563EB',
              border:'none',color:'#fff',fontSize:22,cursor:'pointer',
              display:'flex',alignItems:'center',justifyContent:'center' }}>+</button>
        </div>

        {/* 月份切換 */}
        <div style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:20,marginBottom:16 }}>
          <button onClick={prevMonth}
            style={{ background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#374151' }}>‹</button>
          <span style={{ fontSize:16,fontWeight:700,color:'#111827' }}>{year} 年 {month} 月</span>
          <button onClick={nextMonth}
            style={{ background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#374151' }}>›</button>
        </div>

        {/* 統計 */}
        <div style={{ display:'flex',gap:10,marginBottom:8 }}>
          <div style={{ flex:1,background:'#FFF7ED',borderRadius:12,padding:'12px' }}>
            <p style={{ fontSize:11,fontWeight:700,color:'#F97316',margin:'0 0 4px' }}>BV</p>
            <p style={{ fontSize:20,fontWeight:800,color:'#111827',margin:0 }}>{bvTotal.toFixed(0)}</p>
          </div>
          <div style={{ flex:1,background:'#EFF6FF',borderRadius:12,padding:'12px' }}>
            <p style={{ fontSize:11,fontWeight:700,color:'#3B82F6',margin:'0 0 4px' }}>IBV</p>
            <p style={{ fontSize:20,fontWeight:800,color:'#111827',margin:0 }}>{ibvTotal.toFixed(0)}</p>
          </div>
          <div style={{ flex:1,background:'#F0FDF4',borderRadius:12,padding:'12px' }}>
            <p style={{ fontSize:11,fontWeight:700,color:'#16A34A',margin:'0 0 4px' }}>獲利</p>
            <p style={{ fontSize:18,fontWeight:800,color:'#16A34A',margin:0 }}>NT${profit.toLocaleString()}</p>
          </div>
        </div>
        {giftCost > 0 && (
          <p style={{ fontSize:12,color:'#F97316',textAlign:'right',margin:0 }}>
            贈品成本：-NT${giftCost.toLocaleString()}
          </p>
        )}
      </div>

      {/* 列表 */}
      {loading ? (
        <div style={{ textAlign:'center',padding:40,color:'#9CA3AF' }}>載入中…</div>
      ) : transactions.length === 0 ? (
        <div style={{ textAlign:'center',padding:60,color:'#9CA3AF' }}>
          <p style={{ fontSize:36,margin:'0 0 12px' }}>📊</p>
          <p style={{ fontSize:15 }}>這個月還沒有業績紀錄，點 + 開始新增！</p>
        </div>
      ) : (
        <div style={{ margin:'8px 0',background:'#fff' }}>
          {transactions.map(t => {
            const name = t.customers?.name || '未知顧客'
            const margin = (t.amount||0) - (t.cost||0)
            return (
              <div key={t.id} style={{ display:'flex',alignItems:'center',gap:12,
                padding:'12px 16px',borderBottom:'1px solid #F3F4F6' }}>
                <div style={{ width:40,height:40,borderRadius:'50%',
                  background: t.is_gift ? '#FED7AA' : avatarBg(name),
                  display:'flex',alignItems:'center',justifyContent:'center',
                  color: t.is_gift ? '#F97316' : '#fff',fontWeight:700,fontSize:15,flexShrink:0 }}>
                  {t.is_gift ? '🎁' : name[0]}
                </div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                    <span style={{ fontSize:14,fontWeight:700,color:'#111827' }}>{name}</span>
                    <span style={{ fontSize:11,fontWeight:600,padding:'1px 6px',borderRadius:6,
                      background:t.type==='BV'?'#FFF7ED':'#EFF6FF',
                      color:t.type==='BV'?'#F97316':'#3B82F6' }}>{t.type}</span>
                  </div>
                  <p style={{ fontSize:12,color:'#9CA3AF',margin:'2px 0 0' }}>
                    {t.product_name} · {formatDate(t.date)}
                  </p>
                </div>
                <div style={{ textAlign:'right' }}>
                  <p style={{ fontSize:13,fontWeight:700,color:'#111827',margin:0 }}>
                    {Number(t.points).toFixed(0)} 點
                  </p>
                  <p style={{ fontSize:12,margin:'2px 0 0',
                    color: t.is_gift ? '#F97316' : margin >= 0 ? '#16A34A' : '#DC2626' }}>
                    {t.is_gift ? `-NT$${t.cost||0}` : `+NT$${margin.toLocaleString()}`}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}