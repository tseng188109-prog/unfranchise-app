const PRIMARY = '#1668E3'
const TEXT_MUTED = '#9FAEC2'

// fullPage: true 用於整頁載入（撐滿 100vh，置中）；false 用於區塊內載入（例如列表內、面板內），高度自然、不強制撐滿畫面
export default function LoadingSpinner({ label = '載入中…', fullPage = true }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      minHeight: fullPage ? '100vh' : 'auto', padding: fullPage ? 0 : '40px 0' }}>
      <style>{`@keyframes ls-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width:36, height:36, borderRadius:'50%', border:'3px solid #F0F1F4',
        borderTopColor:PRIMARY, animation:'ls-spin 0.8s linear infinite' }} />
      {label && <p style={{ color:TEXT_MUTED, marginTop:16, fontSize:14 }}>{label}</p>}
    </div>
  )
}
