// 設定 → 邀請朋友一起用：我的邀請連結、QR Code、分享到 LINE、複製連結、存成圖片。
// 連結只帶一組 6 碼的代碼（?r=），不帶 Email 或任何個人資料；朋友點開註冊時，推薦人會自動填上我。
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { inviteLink, lineShareUrl, drawQR, inviteImage, loadImg, isPhone } from '../lib/invite.js'
import { IconBrandLine, IconCopy, IconCheck, IconDownload } from '@tabler/icons-react'
import { PRIMARY, TEXT_MAIN, TEXT_MUTED, TEXT_SECONDARY, BORDER, RADIUS } from './designTokens'

const LINE_GREEN = '#06C755'

async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true } catch { /* 舊瀏覽器走下面 */ }
  try {
    const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok
  } catch { return false }
}

export function InvitePanel({ name }) {
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const cvRef = useRef(null)
  const link = code ? inviteLink(code) : ''

  useEffect(() => {
    let alive = true
    supabase.rpc('my_ref_code').then(({ data, error }) => {
      if (!alive) return
      if (error || !data) setErr('邀請連結暫時拿不到，請稍後再打開一次。')
      else setCode(String(data))
    }, () => { if (alive) setErr('邀請連結暫時拿不到，請稍後再打開一次。') })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!link || !cvRef.current) return
    let alive = true
    const cv = cvRef.current, px = 220, dpr = Math.min(3, window.devicePixelRatio || 1)
    cv.width = px * dpr; cv.height = px * dpr
    loadImg('/pwa-192x192.png').then(icon => {
      if (!alive) return
      const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, px, px)
      drawQR(ctx, link, 20, 20, px - 40, icon)
    })
    return () => { alive = false }
  }, [link])

  async function onCopy() {
    if (await copyText(link)) { setCopied(true); setTimeout(() => setCopied(false), 1800) }
  }
  async function onSave() {
    setSaving(true); setSaveMsg('')
    try {
      const blob = await inviteImage(link, name)
      const file = new File([blob], 'unfranchise-invite.png', { type: 'image/png' })
      if (isPhone() && navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file] }) } catch { /* 使用者自己取消 */ }
      } else {
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000)
        setSaveMsg('圖片已經下載好了。')
      }
    } catch { setSaveMsg('圖片做不出來，請改用複製連結。') }
    setSaving(false)
  }

  const btn = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '12px',
    borderRadius: RADIUS.md, fontSize: 15, fontWeight: 600, cursor: 'pointer', boxSizing: 'border-box', textDecoration: 'none' }
  const ghost = { ...btn, background: 'var(--card)', color: TEXT_MAIN, border: `1px solid ${BORDER}` }

  return (
    <div style={{ background: 'var(--card)', borderRadius: RADIUS.xl, padding: 20, border: `1px solid ${BORDER}` }}>
      <p style={{ fontSize: 14, color: TEXT_SECONDARY, lineHeight: 1.7, margin: '0 0 16px' }}>
        朋友從你的連結或 QR Code 註冊，推薦人就會自動填上你，不用再輸入 Email。
      </p>
      {err && <p style={{ fontSize: 14, color: TEXT_MUTED, margin: 0 }}>{err}</p>}
      {!err && (
        <>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <div style={{ background: '#fff', borderRadius: 20, padding: 6, boxShadow: '0 6px 20px rgba(19,42,77,0.12)', lineHeight: 0 }}>
              {code
                ? <canvas ref={cvRef} aria-label="我的邀請 QR Code" role="img" style={{ width: 220, height: 220 }} />
                : <div style={{ width: 220, height: 220 }} />}
            </div>
          </div>
          <p style={{ textAlign: 'center', fontSize: 12, color: TEXT_MUTED, margin: '0 0 18px', wordBreak: 'break-all' }}>
            {link || '正在產生你的邀請連結…'}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <a href={link ? lineShareUrl(link) : undefined} target="_blank" rel="noopener noreferrer"
              aria-disabled={!link} onClick={e => { if (!link) e.preventDefault() }}
              style={{ ...btn, background: LINE_GREEN, color: '#fff', border: 'none', opacity: link ? 1 : 0.5 }}>
              <IconBrandLine size={20} stroke={1.8} /> 分享到 LINE
            </a>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={onCopy} disabled={!link} style={ghost}>
                {copied ? <IconCheck size={18} stroke={2} color={PRIMARY} /> : <IconCopy size={18} stroke={1.8} />}
                {copied ? '已複製' : '複製連結'}
              </button>
              <button type="button" onClick={onSave} disabled={!link || saving} style={ghost}>
                <IconDownload size={18} stroke={1.8} /> {saving ? '製作中…' : '存 QR 圖片'}
              </button>
            </div>
          </div>
          {saveMsg && <p style={{ fontSize: 13, color: TEXT_SECONDARY, margin: '10px 0 0', textAlign: 'center' }}>{saveMsg}</p>}
          <p style={{ fontSize: 12, color: TEXT_MUTED, lineHeight: 1.7, margin: '16px 0 0' }}>
            存下來的圖片可以印出來、放在 LINE 主頁或限時動態，朋友用手機相機一掃就能註冊。
          </p>
        </>
      )}
    </div>
  )
}
