import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'

const NotFound = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d0d0d' }}>
      <div className="text-center">
        <h1 className="text-6xl font-bold" style={{ color: '#ffffff' }}>404</h1>
        <p className="text-xl mt-4" style={{ color: '#888888' }}>Page not found</p>
        <Button
          className="mt-6"
          onClick={() => navigate('/dashboard')}
          style={{ background: '#ffffff', color: '#000000' }}
        >
          Go to Dashboard
        </Button>
      </div>
    </div>
  )
}

export default NotFound