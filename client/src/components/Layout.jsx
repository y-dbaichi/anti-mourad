import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Button from './ui/Button'

const Layout = ({ children }) => {
  const { user, logout, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <span className="text-2xl font-bold text-gray-900">Mourad</span>
              <span className="px-2 py-0.5 text-xs font-medium bg-secondary-100 text-secondary-700 rounded">
                BETA
              </span>
            </Link>

            {/* Navigation */}
            <nav className="flex items-center gap-4">
              <Link to="/pricing" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
                Tarifs
              </Link>
              <Link to="/api-docs" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
                API
              </Link>

              {isAuthenticated ? (
                <>
                  <Link to="/dashboard">
                    <Button variant="ghost" size="sm">Dashboard</Button>
                  </Link>
                  <Button variant="outline" size="sm" onClick={handleLogout}>
                    Deconnexion
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/auth/login">
                    <Button variant="ghost" size="sm">Connexion</Button>
                  </Link>
                  <Link to="/auth/register">
                    <Button size="sm">S'inscrire</Button>
                  </Link>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main>
        {children}
      </main>
    </div>
  )
}

export default Layout
