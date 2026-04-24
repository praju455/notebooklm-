'use client'

import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageSquare, Database, Settings, Sparkles, Menu, X, Home, Github, Heart, ExternalLink, LogIn, LogOut, User, BarChart3, Sun, Moon } from 'lucide-react'
import { useState, useEffect } from 'react'
import { healthCheck, getAuthConfig } from '@/lib/api'
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google'
import { useAuth } from '@/lib/auth'
import { ThemeProvider, useTheme } from '@/lib/theme'
import toast from 'react-hot-toast'

const inter = Inter({ subsets: ['latin'] })
const isBackendReachable = (status: string) => status === 'healthy' || status === 'initializing'

function AuthButton() {
  const { user, isAuthenticated, logout, setUser, googleClientId, authEnabled } = useAuth()
  const [showMenu, setShowMenu] = useState(false)

  const handleLoginSuccess = (credentialResponse: any) => {
    if (credentialResponse.credential) {
      // Decode the JWT to get user info
      const payload = JSON.parse(atob(credentialResponse.credential.split('.')[1]))
      setUser(
        {
          user_id: payload.sub,
          email: payload.email,
          name: payload.name,
          picture: payload.picture
        },
        credentialResponse.credential
      )
      toast.success(`Welcome, ${payload.name}!`)
    }
  }

  const handleLogout = () => {
    logout()
    setShowMenu(false)
    toast.success('Logged out successfully')
  }

  if (!authEnabled) {
    return null
  }

  if (isAuthenticated && user) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2 p-2 rounded-xl hover:bg-[rgba(255,255,255,0.05)] transition-colors"
        >
          {user.picture ? (
            <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
          )}
          <span className="text-sm font-medium hidden md:block">{user.name}</span>
        </button>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-full mt-2 w-48 bg-[#15151f] dark:bg-[#15151f] border border-[rgba(255,255,255,0.1)] dark:border-[rgba(255,255,255,0.1)] border-pink-200/30 rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="p-3 border-b border-[rgba(255,255,255,0.1)] dark:border-[rgba(255,255,255,0.1)] border-pink-200/20">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-[#64748b] dark:text-[#64748b] text-pink-600/70 truncate">{user.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full p-3 flex items-center gap-2 text-sm text-red-400 dark:text-red-400 text-red-500 hover:bg-[rgba(255,255,255,0.05)] dark:hover:bg-[rgba(255,255,255,0.05)] hover:bg-pink-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="scale-90">
      <GoogleLogin
        onSuccess={handleLoginSuccess}
        onError={() => toast.error('Login failed')}
        theme="filled_black"
        shape="pill"
        size="medium"
      />
    </div>
  )
}

function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <button
        className="p-2 rounded-xl hover:bg-[rgba(255,255,255,0.05)] transition-colors"
        title="Toggle theme"
      >
        <Sun className="w-5 h-5 text-yellow-400" />
      </button>
    )
  }

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-xl hover:bg-[rgba(255,255,255,0.05)] transition-colors"
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? (
        <Sun className="w-5 h-5 text-yellow-400" />
      ) : (
        <Moon className="w-5 h-5 text-indigo-400" />
      )}
    </button>
  )
}

function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [isConnected, setIsConnected] = useState<boolean | null>(null)
  const { setAuthConfig, googleClientId, authEnabled } = useAuth()

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
      if (window.innerWidth < 768) {
        setSidebarOpen(false)
      }
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Check backend connection and get auth config
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const health = await healthCheck()
        setIsConnected(isBackendReachable(health.status))

        // Get auth config
        const authConfig = await getAuthConfig()
        setAuthConfig(authConfig.google_client_id, authConfig.auth_enabled)
      } catch {
        setIsConnected(false)
      }
    }
    checkConnection()
    const interval = setInterval(checkConnection, 30000)
    return () => clearInterval(interval)
  }, [setAuthConfig])

  const navItems = [
    { href: '/', label: 'Dashboard', icon: Home },
    { href: '/chat', label: 'Chat', icon: MessageSquare },
    { href: '/sources', label: 'Sources', icon: Database },
    { href: '/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/settings', label: 'Settings', icon: Settings },
  ]

  return (
    <div className="flex min-h-screen bg-[#fef7ff] dark:bg-[#0a0a0f]">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-50 md:hidden p-2.5 rounded-xl bg-[#15151f]/90 backdrop-blur-xl border border-[rgba(255,255,255,0.08)] shadow-lg"
      >
        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen w-72 bg-[#fef7ff] dark:bg-[#0a0a0f] border-r border-[rgba(255,255,255,0.08)] dark:border-[rgba(255,255,255,0.08)] border-pink-200/30 flex flex-col z-40 transition-transform duration-300 backdrop-blur-xl ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-[rgba(255,255,255,0.08)] dark:border-[rgba(255,255,255,0.08)] border-pink-200/20">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 dark:from-indigo-500 dark:via-purple-500 dark:to-pink-500 from-pink-400 via-rose-400 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20 dark:shadow-purple-500/20 shadow-pink-400/30 group-hover:shadow-purple-500/40 dark:group-hover:shadow-purple-500/40 group-hover:shadow-pink-400/50 transition-shadow">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg gradient-text">Neuron</h1>
              <p className="text-xs text-[#64748b] dark:text-[#64748b] text-pink-600/70">AI-Powered Learning</p>
            </div>
          </Link>
        </div>

        {/* Connection Status */}
        <div className="px-6 py-3 border-b border-[rgba(255,255,255,0.08)] dark:border-[rgba(255,255,255,0.08)] border-pink-200/20">
          <div className={`flex items-center gap-2 text-xs font-medium ${isConnected === null ? 'text-yellow-400' :
            isConnected ? 'text-emerald-400' : 'text-red-400'
            }`}>
            <div className={`w-2 h-2 rounded-full ${isConnected === null ? 'bg-yellow-400 animate-pulse' :
              isConnected ? 'bg-emerald-400' : 'bg-red-400'
              }`} />
            {isConnected === null ? 'Connecting...' : isConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>

        {/* Auth Section */}
        <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.08)] dark:border-[rgba(255,255,255,0.08)] border-pink-200/20 flex items-center justify-between gap-2">
          <AuthButton />
          <ThemeToggle />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1.5">
          <p className="text-xs font-semibold text-[#64748b] uppercase tracking-wider px-3 mb-3">Menu</p>
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => isMobile && setSidebarOpen(false)}
                className={`nav-link ${isActive ? 'active' : ''}`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-[rgba(255,255,255,0.08)] dark:border-[rgba(255,255,255,0.08)] border-pink-200/20">
          <div className="card p-4 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/10 dark:to-purple-500/10 from-pink-100/50 to-rose-100/50 border-indigo-500/20 dark:border-indigo-500/20 border-pink-300/30">
            <p className="text-sm font-medium text-white mb-1">Pro Tip</p>
            <p className="text-xs text-[#94a3b8] dark:text-[#94a3b8] text-pink-700/80">
              Upload PDFs, GitHub repos, or web URLs to get AI answers with citations!
            </p>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        <main className="flex-1">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-[rgba(255,255,255,0.08)] dark:border-[rgba(255,255,255,0.08)] border-pink-200/20 bg-[#fef7ff] dark:bg-[#0a0a0f] backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Left - Branding */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Neuron</p>
                  <p className="text-xs text-[#64748b] dark:text-[#64748b] text-pink-600/70">Multi-model AI</p>
                </div>
              </div>

              {/* Center - Links */}
              <div className="flex items-center gap-6">
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-[#94a3b8] dark:text-[#94a3b8] text-pink-600/70 hover:text-white dark:hover:text-white hover:text-pink-800 transition-colors"
                >
                  <Github className="w-4 h-4" />
                  GitHub
                </a>
                <a
                  href="https://ai.google.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-[#94a3b8] dark:text-[#94a3b8] text-pink-600/70 hover:text-white dark:hover:text-white hover:text-pink-800 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Gemini API
                </a>
              </div>

              {/* Right - Version */}
              <div className="flex items-center gap-1.5 text-sm text-[#64748b] dark:text-[#64748b] text-pink-600/70">
                v2.0.0
              </div>
            </div>

            {/* Bottom bar */}
            <div className="mt-6 pt-4 border-t border-[rgba(255,255,255,0.05)] flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-[#64748b]">
              <p className="text-pink-600/60 dark:text-[#64748b]">&copy; {new Date().getFullYear()} Neuron. All rights reserved.</p>
              <p className="text-pink-600/60 dark:text-[#64748b]">Data auto-deletes after 1 hour for privacy</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <title>Neuron — AI Study Assistant</title>
        <meta name="description" content="AI-powered study assistant — upload docs, ask questions, get cited answers" />
        <link rel="icon" href="/favicon.ico" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme');var light=t==='light'||(t!=='dark'&&!window.matchMedia('(prefers-color-scheme: dark)').matches);var el=document.documentElement;if(light){el.classList.add('light');el.classList.remove('dark');}else{el.classList.add('dark');el.classList.remove('light');}})();`,
          }}
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''}>
            <LayoutContent>{children}</LayoutContent>
          </GoogleOAuthProvider>
        </ThemeProvider>

        {/* Toast Notifications */}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'rgba(21, 21, 31, 0.95)',
              color: '#f8fafc',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(20px)',
              borderRadius: '12px',
              padding: '12px 16px',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#f8fafc',
              },
            },
            error: {
              iconTheme: {
                primary: '#f43f5e',
                secondary: '#f8fafc',
              },
            },
          }}
        />
      </body>
    </html>
  )
}
