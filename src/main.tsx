import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import Home from './pages/Home.tsx'
import CreateEvent from './pages/CreateEvent.tsx'
import EventPage from './pages/EventPage.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<Home />} />
          <Route path="create" element={<CreateEvent />} />
          <Route path="e/:slug" element={<EventPage />} />
        </Route>
      </Routes>
    </HashRouter>
  </StrictMode>,
)
