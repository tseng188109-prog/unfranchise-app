import { useParams } from 'react-router-dom'
import CustomerPanel from './CustomerPanel'

export default function CustomerDetail() {
  const { id } = useParams()
  return (
    <div style={{ background:'#fff', minHeight:'100vh', paddingBottom:40 }}>
      <style>{`
        .dash-container { max-width: 430px; margin: 0 auto; }
        @media (min-width: 1024px) {
          .dash-container { max-width: 720px; }
        }
      `}</style>
      <div className="dash-container">
        <CustomerPanel id={id} />
      </div>
    </div>
  )
}
