import { BrowserRouter, Routes, Route } from 'react-router'
import { useState } from 'react'
import { SessionProvider } from './hooks/useSession.tsx'
import { useTheme } from './hooks/useTheme.ts'
import AppBar from './components/LandingAppBar.tsx'
import DashboardAppBar from './components/DashboardAppBar.tsx'
import Dashboard from './components/Dashboard.tsx'
import LandingPage from './components/LandingPage.tsx'
import CourseOverview from './components/CourseOverview.tsx'
import LessonPage from './components/LessonPage.tsx'
import PlacementPage from './components/PlacementPage.tsx'
import PlacementResults from './components/PlacementResults.tsx'
import Sidebar from './components/Sidebar.tsx'

function LandingShell() {
  const { theme, toggle: toggleTheme } = useTheme()
  return (
    <>
      <AppBar theme={theme} onToggleTheme={toggleTheme} />
      <div style={{ paddingTop: 'var(--chrome-h)' }}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
        </Routes>
      </div>
    </>
  )
}

function DashboardShell() {
  const { theme, toggle: toggleTheme } = useTheme()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <>
      <DashboardAppBar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(o => !o)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <div className="flex" style={{ paddingTop: 'var(--chrome-h)', minHeight: 'calc(100vh - var(--chrome-h))' }}>
        <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(o => !o)} />
        <main className="flex-1 min-w-0 overflow-x-hidden">
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/:course" element={<CourseOverview />} />
            <Route path="/:course/placement" element={<PlacementPage />} />
            <Route path="/:course/placement/results" element={<PlacementResults />} />
            <Route path="/:course/lessons/:slug" element={<LessonPage />} />
          </Routes>
        </main>
      </div>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <Routes>
          <Route path="/" element={<LandingShell />} />
          <Route path="/*" element={<DashboardShell />} />
        </Routes>
      </SessionProvider>
    </BrowserRouter>
  )
}
