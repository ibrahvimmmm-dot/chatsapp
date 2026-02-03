import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './App.css'

console.log('🚀 React app starting...')

try {
  const rootElement = document.getElementById('root')
  
  if (!rootElement) {
    throw new Error('Root element not found')
  }
  
  const root = ReactDOM.createRoot(rootElement)
  
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
  
  console.log('✅ React app mounted successfully')
  
} catch (error) {
  console.error('❌ Error mounting React app:', error)
  document.getElementById('root').innerHTML = `
    <div style="padding: 40px; text-align: center; color: #d63031;">
      <h1>⚠️ Application Error</h1>
      <p>${error.message}</p>
      <p>Please refresh the page or check the console.</p>
    </div>
  `
}