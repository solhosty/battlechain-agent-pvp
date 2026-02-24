import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Dashboard from './components/Dashboard'
import AgentStudio from './components/AgentStudio'
import SpectatorView from './components/SpectatorView'

function App() {
  return (
    <Router>
      <div className="app">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/studio" element={<AgentStudio />} />
          <Route path="/spectate" element={<SpectatorView />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
