'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MessageSquare, Database, Github, FileText, Globe, ArrowRight, Sparkles, Zap, Shield, Clock, BookOpen, Brain, Code } from 'lucide-react'
import { listSources, healthCheck, Source } from '@/lib/api'

const isBackendReachable = (status: string) => status === 'healthy' || status === 'initializing'

export default function Dashboard() {
  const [sources, setSources] = useState<Source[]>([])
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      try {
        const health = await healthCheck()
        setIsHealthy(isBackendReachable(health.status))
        const data = await listSources()
        setSources(data)
      } catch (error) {
        setIsHealthy(false)
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const stats = {
    totalSources: sources.length,
    github: sources.filter(s => s.type === 'github').length,
    pdf: sources.filter(s => s.type === 'pdf').length,
    web: sources.filter(s => s.type === 'web').length,
    totalChunks: sources.reduce((acc, s) => acc + s.chunks, 0),
  }

  const features = [
    {
      icon: Zap,
      title: 'Lightning Fast',
      description: 'Get instant answers powered by semantic search and Gemini AI',
      color: 'from-amber-500 to-orange-500',
      bgColor: 'from-amber-500/10 to-orange-500/10',
    },
    {
      icon: Shield,
      title: 'Accurate Citations',
      description: 'Every answer includes source references you can verify',
      color: 'from-emerald-500 to-teal-500',
      bgColor: 'from-emerald-500/10 to-teal-500/10',
    },
    {
      icon: Clock,
      title: 'Auto Cleanup',
      description: 'Your data is automatically deleted after 1 hour for privacy',
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'from-blue-500/10 to-cyan-500/10',
    },
  ]

  const sourceTypes = [
    {
      icon: Github,
      title: 'GitHub Repos',
      description: 'Import any public repository',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
    },
    {
      icon: FileText,
      title: 'PDF Documents',
      description: 'Upload study materials & papers',
      color: 'text-rose-400',
      bgColor: 'bg-rose-500/10',
    },
    {
      icon: Globe,
      title: 'Web Pages',
      description: 'Scrape documentation & articles',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
    },
  ]

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Hero Section */}
      <div className="relative mb-12 p-8 rounded-3xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${isHealthy === null ? 'bg-yellow-500/20 text-yellow-400' :
              isHealthy ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
              }`}>
              <div className={`w-2 h-2 rounded-full ${isHealthy === null ? 'bg-yellow-400 animate-pulse' :
                isHealthy ? 'bg-emerald-400' : 'bg-red-400'
                }`} />
              {isHealthy === null ? 'Connecting...' : isHealthy ? 'System Online' : 'Disconnected'}
            </div>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            Welcome to <span className="gradient-text">Neuron</span>
          </h1>
          <p className="text-lg text-[#94a3b8] dark:text-[#94a3b8] text-pink-700/80 max-w-2xl mb-6">
            Your AI-powered study companion. Upload your materials and get instant, cited answers from multiple AI models.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link href="/chat" className="btn-primary">
              <MessageSquare className="w-4 h-4" />
              Start Chatting
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/sources" className="btn-secondary">
              <Database className="w-4 h-4" />
              Add Sources
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
        <div className="stat-card">
          <div className="stat-card-value">{loading ? '-' : stats.totalSources}</div>
          <div className="stat-card-label">Total Sources</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value">{loading ? '-' : stats.totalChunks.toLocaleString()}</div>
          <div className="stat-card-label">Knowledge Chunks</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2">
            <Github className="w-5 h-5 text-purple-400" />
            <span className="stat-card-value text-2xl">{loading ? '-' : stats.github}</span>
          </div>
          <div className="stat-card-label">GitHub Repos</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-rose-400" />
            <span className="stat-card-value text-2xl">{loading ? '-' : stats.pdf}</span>
          </div>
          <div className="stat-card-label">PDF Files</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-400" />
            <span className="stat-card-value text-2xl">{loading ? '-' : stats.web}</span>
          </div>
          <div className="stat-card-label">Web Pages</div>
        </div>
      </div>

      {/* Source Types */}
      <div className="mb-10">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-400" />
          Supported Sources
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {sourceTypes.map((type, i) => (
            <Link
              key={i}
              href="/sources"
              className="card card-interactive group flex items-center gap-4"
            >
              <div className={`w-12 h-12 rounded-xl ${type.bgColor} flex items-center justify-center`}>
                <type.icon className={`w-6 h-6 ${type.color}`} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{type.title}</h3>
                <p className="text-sm text-[#94a3b8] dark:text-[#94a3b8] text-pink-700/80">{type.description}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-[#64748b] dark:text-[#64748b] text-pink-600/70 group-hover:text-white dark:group-hover:text-white group-hover:text-pink-800 group-hover:translate-x-1 transition-all" />
            </Link>
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="mb-10">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Code className="w-5 h-5 text-indigo-400" />
          Powerful Features
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {features.map((feature, i) => (
            <div key={i} className={`card bg-gradient-to-br ${feature.bgColor} border-transparent`}>
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 shadow-lg`}>
                <feature.icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-[#94a3b8] dark:text-[#94a3b8] text-pink-700/80">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Sources */}
      {sources.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Database className="w-5 h-5 text-indigo-400" />
              Recent Sources
            </h2>
            <Link href="/sources" className="text-sm text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-2">
            {sources.slice(0, 5).map((source) => (
              <div key={source.id} className="card py-3 px-4 flex items-center justify-between hover:border-indigo-500/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${source.type === 'github' ? 'bg-purple-500/20' :
                    source.type === 'pdf' ? 'bg-rose-500/20' : 'bg-emerald-500/20'
                    }`}>
                    {source.type === 'github' ? <Github className="w-5 h-5 text-purple-400" /> :
                      source.type === 'pdf' ? <FileText className="w-5 h-5 text-rose-400" /> :
                        <Globe className="w-5 h-5 text-emerald-400" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium truncate max-w-[200px] md:max-w-[400px]">
                      {source.name}
                    </p>
                    <p className="text-xs text-[#64748b]">{source.chunks} chunks</p>
                  </div>
                </div>
                <span className={`badge ${source.type === 'github' ? 'badge-github' :
                  source.type === 'pdf' ? 'badge-pdf' : 'badge-web'
                  }`}>
                  {source.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && sources.length === 0 && (
        <div className="card text-center py-12">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-indigo-400" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Ready to learn smarter?</h3>
          <p className="text-[#94a3b8] mb-6 max-w-md mx-auto">
            Add your first source to unlock AI-powered answers with citations. You can also chat without sources!
          </p>
          <div className="flex justify-center gap-3">
            <Link href="/sources" className="btn-primary">
              <Database className="w-4 h-4" />
              Add Sources
            </Link>
            <Link href="/chat" className="btn-secondary">
              <MessageSquare className="w-4 h-4" />
              Start Chatting
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
