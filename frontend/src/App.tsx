import React, { useState, useEffect } from 'react'
import Login from './Login'
import Dashboard from './Dashboard'

const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token)
    } else {
      localStorage.removeItem('token')
    }
  }, [token])

  if (!token) {
    return <Login onLogin={setToken} />
  }

  return <Dashboard token={token} onLogout={() => setToken(null)} />
}

export default App
