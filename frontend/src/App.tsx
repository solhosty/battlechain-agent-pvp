import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import AgentStudio from './components/AgentStudio'
import AppNav from './components/AppNav'
import Dashboard from './components/Dashboard'
import SpectatorView from './components/SpectatorView'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-900 text-white">
        <AppNav />
        <main className="mx-auto w-full max-w-6xl px-4">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/studio" element={<AgentStudio />} />
            <Route path="/spectate" element={<SpectatorView />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App
