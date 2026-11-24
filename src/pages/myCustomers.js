// 新增顧客、編輯顧客用：我的顧客清單（沒封存的），比對同名、比對互動名單的人是不是已經是顧客
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export function useMyCustomers() {
  const [list, setList] = useState([])
  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('customers')
        .select('id,name,contact_id,phone,occupation').eq('user_id', user.id).eq('is_archived', false).limit(2000)
      if (alive) setList(data || [])
    })()
    return () => { alive = false }
  }, [])
  return list
}

