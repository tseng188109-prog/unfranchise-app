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


// 新增互動名單用：我的互動名單（含封存），比對同名、同社群帳號
export function useMyContacts() {
  const [list, setList] = useState([])
  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('contacts')
        .select('id,name,occupation,platform,platform_account,is_archived').eq('user_id', user.id).limit(3000)
      if (alive) setList(data || [])
    })()
    return () => { alive = false }
  }, [])
  return list
}

