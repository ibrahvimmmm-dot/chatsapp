import { useState } from 'react'
import './App.css'
import Login from './components/Login'
import Chat from './components/Chat'

function App() {
  const [username, setUsername] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)

  const handleLogin = (name) => {
    setUsername(name)
    setLoggedIn(true)
  }

  if (!loggedIn) {
    return <Login onLogin={handleLogin} />
  }

  return <Chat username={username} />
}

export default App