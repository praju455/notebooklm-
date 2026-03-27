'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Send, Bot, User, Sparkles, ChevronDown, FileCode, Loader2, Trash2, Database, Plus, X, Upload, Github, Globe, FileText, Cpu, CheckCircle, MessageSquare, Edit2, MoreVertical, Copy, RotateCcw, Download, Search } from 'lucide-react'
import { query, queryStream, listSources, ingestPDF, ingestGitHub, ingestURL, ingestText, Source, Citation, getModelSettings, setModelSettings, getWorkingProviders, getAvailableProviders, ModelConfig, StreamEvent, WebSearchResult, clearConversation } from '@/lib/api'
import AgentThinking from '@/components/AgentThinking'
import WebSearchResults from '@/components/WebSearchResults'
import ToolUsage from '@/components/ToolUsage'
import ConfirmDialog from '@/components/ConfirmDialog'
import MarkdownMessage from '@/components/MarkdownMessage'
import { sessionManager, ChatSession } from '@/lib/sessionManager'
import { exportToJSON, exportToMarkdown, exportToPDF } from '@/lib/utils/export'
import toast from 'react-hot-toast'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  timestamp: Date
  error?: boolean
  errorMessage?: string
  webSearchResults?: WebSearchResult[]
  plan?: {
    steps?: Array<{ type: string; reason: string }>
    requires_tools?: boolean
  }
  toolsUsed?: Array<{ name: string; result?: any }>
}

export interface ModelInfo {
  [key: string]: {
    name: string
    icon: string
    models: Array<{ id: string; name: string }>
  }
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sources, setSources] = useState<Source[]>([])
  const [sourcesLoading, setSourcesLoading] = useState(true)
  const [showUploadPanel, setShowUploadPanel] = useState(false)
  const [uploadType, setUploadType] = useState<'pdf' | 'github' | 'url' | 'text' | null>(null)
  const [uploading, setUploading] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [githubUrl, setGithubUrl] = useState('')
  const [githubBranch, setGithubBranch] = useState('main')
  const [pastedText, setPastedText] = useState('')
  const [textSourceName, setTextSourceName] = useState('')
  const [modelConfig, setModelConfig] = useState<ModelConfig | null>(null)
  const [showModelSelector, setShowModelSelector] = useState(false)
  const [switchingModel, setSwitchingModel] = useState(false)
  const [workingProviders, setWorkingProviders] = useState<Record<string, string[]> | null>(null)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [showSessionsPanel, setShowSessionsPanel] = useState(false)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingSessionName, setEditingSessionName] = useState('')
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingMessageContent, setEditingMessageContent] = useState('')
  const [regeneratingMessageId, setRegeneratingMessageId] = useState<string | null>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showChatMenu, setShowChatMenu] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<string | null>(null)
  const [useStreaming, setUseStreaming] = useState(true)
  const [useAgentic, setUseAgentic] = useState(true)
  const [useWebSearch, setUseWebSearch] = useState(true)
  const [availableProviders, setAvailableProviders] = useState<Record<string, { models: string[] }> | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<null | {
    title: string
    description?: string
    confirmText?: string
    destructive?: boolean
    onConfirm: () => void
  }>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const chatMenuRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const modelSelectorRef = useRef<HTMLDivElement>(null)
  const sessionsPanelRef = useRef<HTMLDivElement>(null)

  const [modelInfo, setModelInfo] = useState<ModelInfo>({
    gemini: {
      name: 'Gemini',
      icon: '✨',
      models: []
    },
    groq: {
      name: 'Groq (LLaMA)',
      icon: '🦙',
      models: []
    },
    anthropic: {
      name: 'Anthropic',
      icon: '🧠',
      models: []
    }
  })

  useEffect(() => {
    setModelInfo((prev) => ({
      ...prev,
      gemini: { ...prev.gemini, icon: 'Gem' },
      groq: { ...prev.groq, icon: 'L3' },
      anthropic: { ...prev.anthropic, icon: 'AI' }
    }))
  }, [])

  useEffect(() => {
    fetchSources()
    loadModelConfig()

    // Fetch available and working providers
    const fetchProviders = async () => {
      try {
        const [available, working] = await Promise.all([
          getAvailableProviders(),
          getWorkingProviders()
        ])

        setAvailableProviders(available.providers)
        setWorkingProviders(working.working_providers)

        // Update model info with fetched models
        setModelInfo((prev: ModelInfo) => {
          const newInfo = { ...prev }

          if (available.providers.gemini) {
            newInfo.gemini.models = available.providers.gemini.models.map(id => ({
              id,
              name: id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
            }))
          }

          if (available.providers.groq) {
            newInfo.groq.models = available.providers.groq.models.map(id => ({
              id,
              name: id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
            }))
          }

          if (available.providers.anthropic) {
            newInfo.anthropic.models = available.providers.anthropic.models.map(id => ({
              id,
              name: id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
            }))
          }

          return newInfo
        })
      } catch (error) {
        console.error('Failed to fetch providers:', error)
      }
    }

    fetchProviders()

    loadSessions()
    // Create initial session if none exists
    const allSessions = sessionManager.getAllSessions()
    if (allSessions.length === 0) {
      const newSession = sessionManager.createSession()
      setCurrentSessionId(newSession.id)
      setSessions([newSession])
    } else {
      setCurrentSessionId(allSessions[0].id)
      setSessions(allSessions)
      loadSessionData(allSessions[0].id)
    }
  }, [])

  useEffect(() => {
    // Save current session when messages or sessionId changes
    if (currentSessionId) {
      sessionManager.updateSession(currentSessionId, {
        messages,
        sessionId
      })
      setSessions(sessionManager.getAllSessions())
    }
  }, [messages, sessionId, currentSessionId])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sessionsPanelRef.current && !sessionsPanelRef.current.contains(event.target as Node)) {
        setShowSessionsPanel(false)
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false)
      }
      if (chatMenuRef.current && !chatMenuRef.current.contains(event.target as Node)) {
        setShowChatMenu(false)
      }
    }
    if (showSessionsPanel || showExportMenu || showChatMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSessionsPanel, showExportMenu, showChatMenu])

  const handleExport = (format: 'json' | 'markdown' | 'pdf') => {
    if (messages.length === 0) {
      toast.error('No messages to export')
      return
    }

    const sessionName = currentSessionId
      ? sessions.find(s => s.id === currentSessionId)?.name || 'Chat'
      : 'Chat'

    try {
      switch (format) {
        case 'json':
          exportToJSON(messages, sessionName)
          toast.success('Exported as JSON')
          break
        case 'markdown':
          exportToMarkdown(messages, sessionName)
          toast.success('Exported as Markdown')
          break
        case 'pdf':
          exportToPDF(messages, sessionName)
          toast.success('Opening PDF preview...')
          break
      }
      setShowExportMenu(false)
    } catch (error) {
      toast.error('Failed to export chat')
      console.error(error)
    }
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelSelectorRef.current && !modelSelectorRef.current.contains(event.target as Node)) {
        setShowModelSelector(false)
      }
    }
    if (showModelSelector) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showModelSelector])

  const loadModelConfig = async () => {
    try {
      const config = await getModelSettings()
      setModelConfig(config)
    } catch (error) {
      console.error('Failed to load model config:', error)
    }
  }

  const loadSessions = () => {
    const allSessions = sessionManager.getAllSessions()
    setSessions(allSessions)
  }

  const loadSessionData = (sessionId: string) => {
    const session = sessionManager.getSession(sessionId)
    if (session) {
      const restoredMessages: Message[] = (session.messages || []).map((msg: any) => ({
        ...msg,
        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
      }))
      setMessages(restoredMessages)
      setSessionId(session.sessionId)
    }
  }

  const switchSession = (sessionId: string, persistCurrent: boolean = true) => {
    // Skip persisting when the current session has just been deleted.
    if (persistCurrent && currentSessionId) {
      sessionManager.updateSession(currentSessionId, {
        messages,
        sessionId
      })
    }
    setCurrentSessionId(sessionId)
    loadSessionData(sessionId)
    setShowSessionsPanel(false)
  }

  const createNewSession = () => {
    const newSession = sessionManager.createSession()
    setCurrentSessionId(newSession.id)
    setMessages([])
    setSessionId(null)
    loadSessions()
    setShowSessionsPanel(false)
    toast.success('New chat created')
  }

  const deleteSession = (targetSessionId: string) => {
    const deletingCurrentSession = currentSessionId === targetSessionId
    const remaining = sessions.filter(s => s.id !== targetSessionId)

    sessionManager.deleteSession(targetSessionId)

    if (remaining.length === 0) {
      const replacementSession = sessionManager.createSession('New Chat')
      setCurrentSessionId(replacementSession.id)
      setMessages([])
      setSessionId(null)
      setShowSessionsPanel(false)
      setShowChatMenu(false)
      loadSessions()
      toast.success('Chat deleted')
      return
    }

    loadSessions()
    if (deletingCurrentSession) {
      switchSession(remaining[0].id, false)
    }
    setShowChatMenu(false)
    toast.success('Session deleted')
  }

  const openDeleteSessionDialog = (targetSessionId: string) => {
    const targetSession = sessions.find(session => session.id === targetSessionId)
    const isLastSession = sessions.length <= 1

    setShowChatMenu(false)
    setConfirmDialog({
      title: isLastSession ? 'Delete this chat?' : 'Delete chat session?',
      description: isLastSession
        ? 'This is your only local chat. We will delete it and open a fresh blank chat for you.'
        : `This will remove "${targetSession?.name || 'this chat'}" from this device. This does not delete your ingested sources.`,
      confirmText: 'Delete chat',
      destructive: true,
      onConfirm: () => deleteSession(targetSessionId),
    })
  }

  const startEditingSession = (sessionId: string) => {
    const session = sessionManager.getSession(sessionId)
    if (session) {
      setEditingSessionId(sessionId)
      setEditingSessionName(session.name)
    }
  }

  const saveSessionName = () => {
    if (editingSessionId && editingSessionName.trim()) {
      sessionManager.renameSession(editingSessionId, editingSessionName.trim())
      loadSessions()
      setEditingSessionId(null)
      setEditingSessionName('')
      toast.success('Session renamed')
    }
  }

  const handleSwitchModel = async (provider: string, model?: string) => {
    setSwitchingModel(true)
    try {
      const result = await setModelSettings(provider, model)
      setModelConfig(result)
      setShowModelSelector(false)
      toast.success(`Switched to ${modelInfo[provider]?.name || provider}`)
    } catch (error: any) {
      toast.error(error.message || 'Failed to switch model')
    } finally {
      setSwitchingModel(false)
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        // Allow Ctrl/Cmd + Enter to send
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault()
          handleSubmit()
          return
        }
        // Allow Ctrl/Cmd + K to focus input (if not already focused)
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
          if (document.activeElement !== inputRef.current) {
            e.preventDefault()
            inputRef.current?.focus()
          }
          return
        }
        return
      }

      // Global shortcuts
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        createNewSession()
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault()
        if (messages.length > 0) {
          setShowExportMenu(true)
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setShowSearch(true)
        setTimeout(() => searchInputRef.current?.focus(), 0)
      }

      if (e.key === 'Escape') {
        setShowSessionsPanel(false)
        setShowModelSelector(false)
        setShowExportMenu(false)
        setShowChatMenu(false)
        setShowUploadPanel(false)
        setShowSearch(false)
        setSearchQuery('')
        if (editingMessageId) {
          setEditingMessageId(null)
          setEditingMessageContent('')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [messages.length, editingMessageId])

  const fetchSources = async () => {
    try {
      const data = await listSources()
      setSources(data)
    } catch (error) {
      console.error('Failed to fetch sources:', error)
    } finally {
      setSourcesLoading(false)
    }
  }

  const handleSubmit = async (e?: React.FormEvent, customQuestion?: string) => {
    e?.preventDefault()
    const question = customQuestion || input.trim()
    if (!question || isLoading) return

    if (modelConfig?.provider === 'none') {
      toast.error('No AI model configured. Add an API key in Settings.')
      return
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: question,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    if (!customQuestion) {
      setInput('')
    }
    setIsLoading(true)

    // Create placeholder assistant message
    const assistantMessageId = (Date.now() + 1).toString()
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      citations: [],
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, assistantMessage])

    if (useStreaming) {
      // Use streaming with agentic features
      let accumulatedContent = ''
      let webSearchResults: WebSearchResult[] = []
      let plan: { steps?: Array<{ type: string; reason: string }>; requires_tools?: boolean } | undefined = undefined
      let toolsUsed: Array<{ name: string; result?: any }> = []

      await queryStream(
        question,
        sessionId || undefined,
        (event: StreamEvent) => {
          if (event.type === 'chunk') {
            accumulatedContent += event.content || ''
            setMessages(prev => prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: accumulatedContent }
                : msg
            ))
          } else if (event.type === 'web_search') {
            webSearchResults = event.web_search || []
            setMessages(prev => prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, webSearchResults }
                : msg
            ))
          } else if (event.type === 'done') {
            setSessionId(event.session_id || sessionId || null)
            setMessages(prev => prev.map(msg =>
              msg.id === assistantMessageId
                ? {
                  ...msg,
                  citations: event.citations || [],
                  ...(plan ? { plan } : {}),
                  ...(toolsUsed.length > 0 ? { toolsUsed } : {})
                }
                : msg
            ))
            setIsLoading(false)
          } else if (event.type === 'error') {
            setMessages(prev => prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, error: true, errorMessage: event.error || 'Unknown error', content: '' }
                : msg
            ))
            setIsLoading(false)
            toast.error(event.error || 'Unknown error')
          }
        },
        10,
        selectedSourceFilter || undefined,
        useAgentic,
        useWebSearch
      )
    } else {
      // Use regular query
      try {
        const response = await query(
          question,
          sessionId || undefined,
          10,
          selectedSourceFilter || undefined,
          useAgentic,
          useWebSearch
        )
        setSessionId(response.session_id)

        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: response.answer, citations: response.citations }
            : msg
        ))
      } catch (error: any) {
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, error: true, errorMessage: error.message || 'Failed to get response', content: '' }
            : msg
        ))
        toast.error(error.message || 'Failed to get response')
        console.error(error)
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleRetry = async (messageId: string) => {
    const messageIndex = messages.findIndex(m => m.id === messageId)
    if (messageIndex === -1 || messageIndex === 0) return

    const userMessage = messages[messageIndex - 1]
    if (userMessage.role !== 'user') return

    // Remove error message
    const updatedMessages = messages.slice(0, messageIndex)
    setMessages(updatedMessages)

    // Retry the query
    setIsLoading(true)
    try {
      const response = await query(userMessage.content, sessionId || undefined, 5, selectedSourceFilter || undefined, useAgentic, useWebSearch)
      setSessionId(response.session_id)

      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: response.answer,
        citations: response.citations,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error: any) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        error: true,
        errorMessage: error.message || 'Failed to get response'
      }
      setMessages(prev => [...prev, errorMessage])
      toast.error(error.message || 'Failed to get response')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditMessage = (messageId: string) => {
    const message = messages.find(m => m.id === messageId)
    if (message && message.role === 'user') {
      setEditingMessageId(messageId)
      setEditingMessageContent(message.content)
    }
  }

  const handleSaveEdit = () => {
    if (!editingMessageId || !editingMessageContent.trim()) return

    const messageIndex = messages.findIndex(m => m.id === editingMessageId)
    if (messageIndex === -1) return

    // Update the message
    const updatedMessages = [...messages]
    updatedMessages[messageIndex] = {
      ...updatedMessages[messageIndex],
      content: editingMessageContent.trim()
    }

    // Remove all messages after this one (to regenerate from this point)
    const messagesToKeep = updatedMessages.slice(0, messageIndex + 1)
    setMessages(messagesToKeep)

    // Re-send the edited message
    setEditingMessageId(null)
    setEditingMessageContent('')
    handleSubmit(undefined, editingMessageContent.trim())
  }

  const deleteMessageNow = (messageId: string) => {
    const messageIndex = messages.findIndex(m => m.id === messageId)
    if (messageIndex === -1) return

    // If deleting a user message, also remove the assistant response after it
    const message = messages[messageIndex]
    let messagesToRemove = 1
    if (message.role === 'user' && messageIndex + 1 < messages.length) {
      const nextMessage = messages[messageIndex + 1]
      if (nextMessage.role === 'assistant') {
        messagesToRemove = 2
      }
    }

    const updatedMessages = messages.filter((_, index) => {
      if (message.role === 'user') {
        return index < messageIndex || index >= messageIndex + messagesToRemove
      }
      return index !== messageIndex
    })

    setMessages(updatedMessages)
    toast.success('Message deleted')
  }

  const handleDeleteMessage = (messageId: string) => {
    const messageIndex = messages.findIndex(m => m.id === messageId)
    if (messageIndex === -1) return

    const message = messages[messageIndex]
    const extra =
      message.role === 'user' && messageIndex + 1 < messages.length && messages[messageIndex + 1].role === 'assistant'
        ? ' (and its assistant reply)'
        : ''

    setConfirmDialog({
      title: 'Delete message?',
      description: `This will remove this message${extra} from this chat session.`,
      confirmText: 'Delete',
      destructive: true,
      onConfirm: () => deleteMessageNow(messageId),
    })
  }

  const handleRegenerate = async (messageId: string) => {
    const messageIndex = messages.findIndex(m => m.id === messageId)
    if (messageIndex === -1 || messageIndex === 0) return

    const userMessage = messages[messageIndex - 1]
    if (userMessage.role !== 'user') return

    setRegeneratingMessageId(messageId)

    // Remove the assistant message
    const messagesToKeep = messages.slice(0, messageIndex)
    setMessages(messagesToKeep)

    // Re-send the user's question
    try {
      const response = await query(userMessage.content, sessionId || undefined, 5, selectedSourceFilter || undefined, useAgentic, useWebSearch)
      setSessionId(response.session_id)

      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: response.answer,
        citations: response.citations,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error: any) {
      toast.error(error.message || 'Failed to regenerate response')
    } finally {
      setRegeneratingMessageId(null)
    }
  }

  const handleCopyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      toast.success('Copied to clipboard')
    } catch (error) {
      toast.error('Failed to copy')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const clearChatNow = async () => {
    if (sessionId) {
      try {
        await clearConversation(sessionId)
      } catch (error) {
        console.error('Failed to clear conversation on server:', error)
      }
    }
    setMessages([])
    setSessionId(null)
    if (currentSessionId) {
      sessionManager.updateSession(currentSessionId, {
        messages: [],
        sessionId: null
      })
    }
    toast.success('Chat cleared')
  }

  const clearChat = () => {
    if (messages.length === 0) {
      toast('Chat is already empty')
      return
    }
    setConfirmDialog({
      title: 'Clear this chat?',
      description: 'This will remove all messages in the current session (and clear server-side conversation state).',
      confirmText: 'Clear chat',
      destructive: true,
      onConfirm: () => {
        void clearChatNow()
      },
    })
  }

  const adjustTextareaHeight = () => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 160) + 'px'
    }
  }

  // Upload handlers
  const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedExtensions = ['.pdf', '.xlsx', '.xls', '.csv']
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
    if (!allowedExtensions.includes(ext)) {
      toast.error('Please select a PDF, Excel, or CSV file')
      return
    }

    setUploading(true)
    try {
      const result = await ingestPDF(file)
      toast.success(`Uploaded ${file.name} (${result.chunks_created} chunks)`)
      fetchSources()
      setShowUploadPanel(false)
      setUploadType(null)
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload file')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleURLSubmit = async () => {
    if (!urlInput.trim()) return

    setUploading(true)
    try {
      const result = await ingestURL(urlInput.trim())
      toast.success(`Added URL (${result.chunks_created} chunks)`)
      fetchSources()
      setUrlInput('')
      setShowUploadPanel(false)
      setUploadType(null)
    } catch (error: any) {
      toast.error(error.message || 'Failed to add URL')
    } finally {
      setUploading(false)
    }
  }

  const handleGitHubSubmit = async () => {
    if (!githubUrl.trim()) return

    setUploading(true)
    try {
      const result = await ingestGitHub(githubUrl.trim(), githubBranch)
      toast.success(`Added repo (${result.chunks_created} chunks)`)
      fetchSources()
      setGithubUrl('')
      setGithubBranch('main')
      setShowUploadPanel(false)
      setUploadType(null)
    } catch (error: any) {
      toast.error(error.message || 'Failed to add repository')
    } finally {
      setUploading(false)
    }
  }

  const handleTextSubmit = async () => {
    if (!pastedText.trim()) return

    setUploading(true)
    try {
      const result = await ingestText(pastedText.trim(), textSourceName.trim() || undefined)
      toast.success(`Added text (${result.chunks_created} chunks)`)
      fetchSources()
      setPastedText('')
      setTextSourceName('')
      setShowUploadPanel(false)
      setUploadType(null)
    } catch (error: any) {
      toast.error(error.message || 'Failed to add text')
    } finally {
      setUploading(false)
    }
  }

  const currentSession = currentSessionId
    ? sessions.find(session => session.id === currentSessionId) || null
    : null
  const currentSessionName = currentSession?.name || 'Chat'

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 border-b border-[rgba(255,255,255,0.08)] dark:border-[rgba(255,255,255,0.08)] border-pink-200/30 bg-[#0a0a0f]/80 dark:bg-[#0a0a0f]/80 bg-white/90 backdrop-blur-xl px-3 py-3">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              onClick={() => setShowSessionsPanel(!showSessionsPanel)}
              className="btn-ghost flex items-center gap-2 text-sm flex-shrink-0"
              title="Chat sessions"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden md:inline">Sessions</span>
            </button>
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 dark:from-indigo-500 dark:to-purple-600 from-pink-400 to-rose-500">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-semibold sm:text-base">{currentSessionName}</h1>
              <p className="truncate text-xs text-[#64748b] dark:text-[#64748b] text-pink-600/70">
                {sourcesLoading ? 'Loading sources...' : `${sources.length} source${sources.length !== 1 ? 's' : ''} loaded`}
                {messages.length > 0 ? ` • ${messages.length} message${messages.length !== 1 ? 's' : ''}` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              onClick={createNewSession}
              className="btn-ghost flex items-center gap-2 text-sm"
              title="New chat"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Chat</span>
            </button>

            {messages.length > 0 && (
              <>
                <button
                  onClick={() => {
                    setShowSearch(!showSearch)
                    if (!showSearch) {
                      setTimeout(() => searchInputRef.current?.focus(), 0)
                    } else {
                      setSearchQuery('')
                    }
                  }}
                  className="btn-ghost flex items-center gap-2"
                  title="Search messages (Ctrl/Cmd + F)"
                >
                  <Search className="w-4 h-4" />
                  <span className="hidden sm:inline">Search</span>
                </button>

                <div className="relative" ref={exportMenuRef}>
                  <button
                    onClick={() => {
                      setShowChatMenu(false)
                      setShowExportMenu(!showExportMenu)
                    }}
                    className="btn-ghost flex items-center gap-2"
                    title="Export chat"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Export</span>
                  </button>
                  {showExportMenu && (
                    <div className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border border-[rgba(255,255,255,0.1)] dark:border-[rgba(255,255,255,0.1)] border-pink-200/30 bg-[#15151f] dark:bg-[#15151f] bg-white shadow-xl">
                      <button
                        onClick={() => handleExport('json')}
                        className="w-full px-4 py-2 text-left text-sm transition-colors hover:bg-[rgba(255,255,255,0.05)]"
                      >
                        Export as JSON
                      </button>
                      <button
                        onClick={() => handleExport('markdown')}
                        className="w-full px-4 py-2 text-left text-sm transition-colors hover:bg-[rgba(255,255,255,0.05)]"
                      >
                        Export as Markdown
                      </button>
                      <button
                        onClick={() => handleExport('pdf')}
                        className="w-full px-4 py-2 text-left text-sm transition-colors hover:bg-[rgba(255,255,255,0.05)]"
                      >
                        Export as PDF
                      </button>
                    </div>
                  )}
                </div>

                <div className="relative" ref={chatMenuRef}>
                  <button
                    onClick={() => {
                      setShowExportMenu(false)
                      setShowChatMenu(!showChatMenu)
                    }}
                    className="btn-ghost p-2.5"
                    title="Chat options"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {showChatMenu && (
                    <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.1)] dark:border-[rgba(255,255,255,0.1)] border-pink-200/30 bg-[#15151f] dark:bg-[#15151f] bg-white shadow-xl">
                      <div className="space-y-3 p-3">
                        {sources.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-medium uppercase tracking-wide text-[#64748b] dark:text-[#64748b] text-pink-600/70">
                              Source Filter
                            </p>
                            <select
                              value={selectedSourceFilter || ''}
                              onChange={(e) => setSelectedSourceFilter(e.target.value || null)}
                              className="w-full rounded-xl border border-[rgba(255,255,255,0.1)] dark:border-[rgba(255,255,255,0.1)] border-pink-200/30 bg-[#0f0f16] dark:bg-[#0f0f16] bg-white px-3 py-2 text-sm outline-none"
                              title="Filter by source"
                            >
                              <option value="">All Sources</option>
                              {sources.map((source) => (
                                <option key={source.id} value={source.id}>
                                  {source.name}
                                </option>
                              ))}
                            </select>
                            {selectedSourceFilter && (
                              <button
                                onClick={() => setSelectedSourceFilter(null)}
                                className="text-xs text-indigo-400 transition-colors hover:text-indigo-300"
                              >
                                Clear source filter
                              </button>
                            )}
                          </div>
                        )}

                        <label className="flex items-center justify-between gap-3 rounded-xl border border-[rgba(255,255,255,0.08)] dark:border-[rgba(255,255,255,0.08)] border-pink-200/20 px-3 py-2 text-sm">
                          <span>Agentic mode</span>
                          <input
                            type="checkbox"
                            checked={useAgentic}
                            onChange={(e) => setUseAgentic(e.target.checked)}
                            className="h-4 w-4"
                          />
                        </label>

                        <div className="space-y-2">
                          <button
                            onClick={() => {
                              setShowChatMenu(false)
                              clearChat()
                            }}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-[rgba(255,255,255,0.05)]"
                          >
                            <Trash2 className="w-4 h-4" />
                            Clear messages
                          </button>
                          {currentSessionId && (
                            <button
                              onClick={() => openDeleteSessionDialog(currentSessionId)}
                              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-red-400 transition-colors hover:bg-red-500/10"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete chat
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Sessions Panel */}
      {showSessionsPanel && (
        <div className="absolute left-0 top-0 bottom-0 w-80 bg-[#0a0a0f] dark:bg-[#0a0a0f] bg-white border-r border-[rgba(255,255,255,0.08)] dark:border-[rgba(255,255,255,0.08)] border-pink-200/30 z-40 flex flex-col" ref={sessionsPanelRef}>
          <div className="p-4 border-b border-[rgba(255,255,255,0.08)] dark:border-[rgba(255,255,255,0.08)] border-pink-200/20">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Chat Sessions</h2>
              <button
                onClick={() => setShowSessionsPanel(false)}
                className="text-[#64748b] dark:text-[#64748b] text-pink-600/70 hover:text-white dark:hover:text-white hover:text-pink-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <button
              onClick={createNewSession}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Chat
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <div className="space-y-1">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`group relative p-3 rounded-lg cursor-pointer transition-all ${currentSessionId === session.id
                    ? 'bg-indigo-500/20 border border-indigo-500/50'
                    : 'hover:bg-[rgba(255,255,255,0.05)] border border-transparent'
                    }`}
                  onClick={() => switchSession(session.id)}
                >
                  {editingSessionId === session.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editingSessionName}
                        onChange={(e) => setEditingSessionName(e.target.value)}
                        onBlur={saveSessionName}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveSessionName()
                          if (e.key === 'Escape') {
                            setEditingSessionId(null)
                            setEditingSessionName('')
                          }
                        }}
                        className="flex-1 bg-[#15151f] dark:bg-[#15151f] bg-white border border-indigo-500/50 dark:border-indigo-500/50 border-pink-300/50 rounded px-2 py-1 text-sm text-white dark:text-white text-gray-800 outline-none"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-1">
                        <MessageSquare className="w-4 h-4 text-[#64748b]" />
                        <span className="font-medium text-sm truncate flex-1">{session.name}</span>
                      </div>
                      <p className="text-xs text-[#64748b] dark:text-[#64748b] text-pink-600/70">
                        {new Date(session.updatedAt).toLocaleDateString()} • {session.messages.length} messages
                      </p>
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            startEditingSession(session.id)
                          }}
                          className="p-1 rounded hover:bg-[rgba(255,255,255,0.1)]"
                          title="Rename"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openDeleteSessionDialog(session.id)
                          }}
                          className="p-1 rounded hover:bg-red-500/20 text-red-400"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Available Models List */}
            <div className="mt-6 pt-4 border-t border-[rgba(255,255,255,0.08)] dark:border-[rgba(255,255,255,0.08)] border-pink-200/20">
              <h3 className="text-xs font-semibold text-[#94a3b8] dark:text-[#94a3b8] text-pink-600/80 mb-3 px-3 uppercase tracking-wider flex items-center gap-2">
                <Cpu className="w-3 h-3" />
                Available Models
              </h3>
              <div className="space-y-3 px-3">
                {Object.entries(modelInfo).map(([provider, info]: [string, any]) => (
                  <div key={provider} className="text-sm">
                    <div className="flex items-center gap-2 text-indigo-300 dark:text-indigo-300 text-pink-600 mb-1">
                      <span>{info.icon}</span>
                      <span className="font-medium capitalize">{info.name}</span>
                    </div>
                    <div className="pl-6 space-y-1">
                      {info.models.map((m: any) => (
                        <div key={m.id} className="text-xs text-[#64748b] dark:text-[#64748b] text-pink-600/70 flex items-center gap-1">
                          <div className="w-1 h-1 rounded-full bg-[#64748b] dark:bg-[#64748b] bg-pink-400"></div>
                          {m.name}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search Bar */}
      {showSearch && messages.length > 0 && (
        <div className="shrink-0 border-b border-[rgba(255,255,255,0.08)] dark:border-[rgba(255,255,255,0.08)] border-pink-200/30 bg-[#0a0a0f]/80 dark:bg-[#0a0a0f]/80 bg-white/90 backdrop-blur-xl px-3 py-2.5">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-2">
            <Search className="w-4 h-4 text-[#64748b]" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages..."
              className="flex-1 bg-[#15151f] dark:bg-[#15151f] bg-white border border-[rgba(255,255,255,0.1)] dark:border-[rgba(255,255,255,0.1)] border-pink-200/30 rounded-lg px-3 py-2 text-sm text-white dark:text-white text-gray-800 placeholder-[#64748b] dark:placeholder-[#64748b] placeholder-pink-400/60 focus:border-indigo-500 dark:focus:border-indigo-500 focus:border-pink-400 outline-none"
            />
            <button
              onClick={() => {
                setShowSearch(false)
                setSearchQuery('')
              }}
              className="text-[#64748b] dark:text-[#64748b] text-pink-600/70 hover:text-white dark:hover:text-white hover:text-pink-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {searchQuery && (
            <div className="mx-auto mt-2 w-full max-w-6xl text-xs text-[#64748b] dark:text-[#64748b] text-pink-600/70">
              Found {messages.filter(m =>
                m.content.toLowerCase().includes(searchQuery.toLowerCase())
              ).length} message(s)
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4 md:px-6">
        <div className="mx-auto w-full max-w-6xl">
          {messages.length === 0 ? (
            <WelcomeScreen sources={sources} sourcesLoading={sourcesLoading} onAddSource={() => setShowUploadPanel(true)} />
          ) : (
            <div className="space-y-6">
              {messages
                .filter(message =>
                  !searchQuery ||
                  message.content.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((message, index) => {
                  const originalIndex = messages.findIndex(m => m.id === message.id)

                  // Hide empty assistant messages if we are loading (TypingIndicator handles it)
                  // But if content has started streaming, show the message and hide TypingIndicator
                  if (message.role === 'assistant' && !message.content && isLoading && index === messages.length - 1) {
                    return null
                  }

                  return (
                    <div key={message.id}>
                      {message.role === 'assistant' && message.plan && (
                        <AgentThinking isThinking={false} plan={message.plan} />
                      )}
                      {message.role === 'assistant' && message.toolsUsed && message.toolsUsed.map((tool, idx) => (
                        <ToolUsage key={idx} toolName={tool.name} toolResult={tool.result} />
                      ))}
                      <MessageBubble
                        message={message}
                        isEditing={editingMessageId === message.id}
                        editingContent={editingMessageContent}
                        onEditContentChange={setEditingMessageContent}
                        onSaveEdit={handleSaveEdit}
                        onCancelEdit={() => {
                          setEditingMessageId(null)
                          setEditingMessageContent('')
                        }}
                        onEdit={() => handleEditMessage(message.id)}
                        onDelete={() => handleDeleteMessage(message.id)}
                        onRegenerate={() => handleRegenerate(message.id)}
                        onCopy={handleCopyMessage}
                        onRetry={message.error ? () => handleRetry(message.id) : undefined}
                        canRegenerate={message.role === 'assistant' && originalIndex > 0 && messages[originalIndex - 1].role === 'user'}
                        isRegenerating={regeneratingMessageId === message.id}
                        highlightText={searchQuery}
                      />
                      {message.role === 'assistant' && message.webSearchResults && message.webSearchResults.length > 0 && (
                        <div className="ml-14 mt-2">
                          <WebSearchResults results={message.webSearchResults} />
                        </div>
                      )}
                    </div>
                  )
                })}
              {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && !messages[messages.length - 1].content && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Upload Panel */}
      {showUploadPanel && (
        <div className="shrink-0 border-t border-[rgba(255,255,255,0.08)] dark:border-[rgba(255,255,255,0.08)] border-pink-200/30 bg-[#0a0a0f]/95 dark:bg-[#0a0a0f]/95 bg-white/95 backdrop-blur-xl px-3 py-3">
          <div className="mx-auto w-full max-w-6xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">Add Source</h3>
              <button onClick={() => { setShowUploadPanel(false); setUploadType(null) }} className="text-[#64748b] dark:text-[#64748b] text-pink-600/70 hover:text-white dark:hover:text-white hover:text-pink-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!uploadType ? (
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setUploadType('pdf')}
                  className="card card-interactive p-4 flex flex-col items-center gap-2"
                >
                  <div className="w-10 h-10 rounded-lg bg-rose-500/20 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-rose-400" />
                  </div>
                  <span className="text-sm font-medium">PDF</span>
                </button>
                <button
                  onClick={() => setUploadType('url')}
                  className="card card-interactive p-4 flex flex-col items-center gap-2"
                >
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <Globe className="w-5 h-5 text-emerald-400" />
                  </div>
                  <span className="text-sm font-medium">Website</span>
                </button>
                <button
                  onClick={() => setUploadType('github')}
                  className="card card-interactive p-4 flex flex-col items-center gap-2"
                >
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Github className="w-5 h-5 text-purple-400" />
                  </div>
                  <span className="text-sm font-medium">GitHub</span>
                </button>
                <button
                  onClick={() => setUploadType('text')}
                  className="card card-interactive p-4 flex flex-col items-center gap-2"
                >
                  <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-amber-400" />
                  </div>
                  <span className="text-sm font-medium">Paste text</span>
                </button>
              </div>
            ) : uploadType === 'pdf' ? (
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.xlsx,.xls,.csv"
                  onChange={handlePDFUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full card card-interactive p-6 border-dashed flex flex-col items-center gap-2"
                >
                  {uploading ? (
                    <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                  ) : (
                    <Upload className="w-8 h-8 text-rose-400" />
                  )}
                  <span className="text-sm">{uploading ? 'Uploading...' : 'Click to select file (PDF, Excel, CSV)'}</span>
                </button>
                <button onClick={() => setUploadType(null)} className="text-sm text-[#64748b] dark:text-[#64748b] text-pink-600/70 hover:text-white dark:hover:text-white hover:text-pink-800">
                  Back
                </button>
              </div>
            ) : uploadType === 'url' ? (
              <div className="space-y-3">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/article"
                  className="w-full bg-[#15151f] dark:bg-[#15151f] bg-white border border-[rgba(255,255,255,0.1)] dark:border-[rgba(255,255,255,0.1)] border-pink-200/30 rounded-xl px-4 py-3 text-white dark:text-white text-gray-800 placeholder-[#64748b] dark:placeholder-[#64748b] placeholder-pink-400/60 focus:border-indigo-500 dark:focus:border-indigo-500 focus:border-pink-400 outline-none"
                />
                <div className="flex gap-2">
                  <button onClick={() => setUploadType(null)} className="btn-ghost text-sm">
                    Back
                  </button>
                  <button
                    onClick={handleURLSubmit}
                    disabled={uploading || !urlInput.trim()}
                    className="btn-primary flex-1"
                  >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add URL'}
                  </button>
                </div>
              </div>
            ) : uploadType === 'github' ? (
              <div className="space-y-3">
                <input
                  type="url"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/user/repo"
                  className="w-full bg-[#15151f] dark:bg-[#15151f] bg-white border border-[rgba(255,255,255,0.1)] dark:border-[rgba(255,255,255,0.1)] border-pink-200/30 rounded-xl px-4 py-3 text-white dark:text-white text-gray-800 placeholder-[#64748b] dark:placeholder-[#64748b] placeholder-pink-400/60 focus:border-indigo-500 dark:focus:border-indigo-500 focus:border-pink-400 outline-none"
                />
                <input
                  type="text"
                  value={githubBranch}
                  onChange={(e) => setGithubBranch(e.target.value)}
                  placeholder="Branch (default: main)"
                  className="w-full bg-[#15151f] dark:bg-[#15151f] bg-white border border-[rgba(255,255,255,0.1)] dark:border-[rgba(255,255,255,0.1)] border-pink-200/30 rounded-xl px-4 py-3 text-white dark:text-white text-gray-800 placeholder-[#64748b] dark:placeholder-[#64748b] placeholder-pink-400/60 focus:border-indigo-500 dark:focus:border-indigo-500 focus:border-pink-400 outline-none"
                />
                <div className="flex gap-2">
                  <button onClick={() => setUploadType(null)} className="btn-ghost text-sm">
                    Back
                  </button>
                  <button
                    onClick={handleGitHubSubmit}
                    disabled={uploading || !githubUrl.trim()}
                    className="btn-primary flex-1"
                  >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Repo'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Paste or type any text..."
                  className="w-full bg-[#15151f] dark:bg-[#15151f] bg-white border border-[rgba(255,255,255,0.1)] dark:border-[rgba(255,255,255,0.1)] border-pink-200/30 rounded-xl px-4 py-3 text-white dark:text-white text-gray-800 placeholder-[#64748b] dark:placeholder-[#64748b] placeholder-pink-400/60 focus:border-indigo-500 dark:focus:border-indigo-500 focus:border-pink-400 outline-none min-h-[100px] resize-y"
                />
                <input
                  type="text"
                  value={textSourceName}
                  onChange={(e) => setTextSourceName(e.target.value)}
                  placeholder="Name (optional)"
                  className="w-full bg-[#15151f] dark:bg-[#15151f] bg-white border border-[rgba(255,255,255,0.1)] dark:border-[rgba(255,255,255,0.1)] border-pink-200/30 rounded-xl px-4 py-3 text-white dark:text-white text-gray-800 placeholder-[#64748b] dark:placeholder-[#64748b] placeholder-pink-400/60 focus:border-indigo-500 dark:focus:border-indigo-500 focus:border-pink-400 outline-none"
                />
                <div className="flex gap-2">
                  <button onClick={() => setUploadType(null)} className="btn-ghost text-sm">
                    Back
                  </button>
                  <button
                    onClick={handleTextSubmit}
                    disabled={uploading || !pastedText.trim()}
                    className="btn-primary flex-1"
                  >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add text'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 border-t border-[rgba(255,255,255,0.08)] dark:border-[rgba(255,255,255,0.08)] border-pink-200/30 bg-[#0a0a0f]/80 dark:bg-[#0a0a0f]/80 bg-white/90 backdrop-blur-xl px-3 py-3">
        <form onSubmit={handleSubmit} className="mx-auto w-full max-w-6xl">
          <div className="glass dark:glass rounded-2xl border border-pink-200/40 bg-white/80 p-1.5 transition-all focus-within:border-indigo-500/50 dark:focus-within:border-indigo-500/50 focus-within:border-pink-400/50 dark:bg-transparent dark:border-[rgba(255,255,255,0.1)]">
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => setShowUploadPanel(!showUploadPanel)}
                className={`rounded-xl p-2.5 transition-all ${showUploadPanel ? 'bg-indigo-500/20 dark:bg-indigo-500/20 bg-pink-200/50 text-indigo-400 dark:text-indigo-400 text-pink-600' : 'text-[#64748b] dark:text-[#64748b] text-pink-600/70 hover:text-white dark:hover:text-white hover:text-pink-800 hover:bg-[rgba(255,255,255,0.05)] dark:hover:bg-[rgba(255,255,255,0.05)] hover:bg-pink-100/50'}`}
                title="Add source"
              >
                <Plus className="w-5 h-5" />
              </button>
              <div className="relative" ref={modelSelectorRef}>
                <button
                  type="button"
                  onClick={() => setShowModelSelector(!showModelSelector)}
                  className={`flex items-center gap-1.5 rounded-xl p-2.5 transition-all ${showModelSelector ? 'bg-indigo-500/20 dark:bg-indigo-500/20 bg-pink-200/50 text-indigo-400 dark:text-indigo-400 text-pink-600' : 'text-[#64748b] dark:text-[#64748b] text-pink-600/70 hover:text-white dark:hover:text-white hover:text-pink-800 hover:bg-[rgba(255,255,255,0.05)] dark:hover:bg-[rgba(255,255,255,0.05)] hover:bg-pink-100/50'}`}
                  title="Change model"
                >
                  {modelConfig ? (
                    <>
                      <span className="text-sm">{modelInfo[modelConfig.provider]?.icon || '🤖'}</span>
                      <span className="text-xs font-medium hidden sm:inline max-w-[80px] truncate">{modelConfig.model.split('-').slice(0, 2).join('-')}</span>
                    </>
                  ) : (
                    <Cpu className="w-4 h-4" />
                  )}
                  <ChevronDown className={`w-3 h-3 transition-transform ${showModelSelector ? 'rotate-180' : ''}`} />
                </button>

                {showModelSelector && (
                  <div className="absolute left-0 bottom-full mb-2 w-64 bg-[#15151f] dark:bg-[#15151f] bg-white border border-[rgba(255,255,255,0.1)] dark:border-[rgba(255,255,255,0.1)] border-pink-200/30 rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="p-2">
                      {modelConfig && Object.entries(modelInfo).map(([key, info]: [string, any]) => {
                        const isActive = modelConfig.provider === key
                        const inWorking = workingProviders === null || workingProviders[key]
                        const isAvailable = modelConfig.available_providers.includes(key) && inWorking

                        if (!isAvailable) return null

                        return (
                          <div key={key}>
                            <button
                              onClick={() => isAvailable && !isActive && handleSwitchModel(key)}
                              disabled={!isAvailable || switchingModel}
                              className={`w-full p-3 rounded-lg text-left transition-all mb-1 ${isActive
                                ? 'bg-indigo-500/20 dark:bg-indigo-500/20 bg-pink-100/50 border border-indigo-500/50 dark:border-indigo-500/50 border-pink-400/50'
                                : 'hover:bg-[rgba(255,255,255,0.05)] dark:hover:bg-[rgba(255,255,255,0.05)] hover:bg-pink-50 border border-transparent'
                                }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span>{info.icon}</span>
                                  <span className="font-medium text-sm text-gray-800 dark:text-white">{info.name}</span>
                                </div>
                                {isActive && <CheckCircle className="w-4 h-4 text-indigo-400 dark:text-indigo-400 text-pink-500" />}
                              </div>
                            </button>
                            {isActive && (
                              <div className="pl-4 pr-2 pb-2 space-y-1">
                                {(workingProviders?.[key]
                                  ? info.models.filter((m: any) => workingProviders[key].includes(m.id))
                                  : info.models
                                ).map((model: any) => (
                                  <button
                                    key={model.id}
                                    onClick={() => handleSwitchModel(key, model.id)}
                                    disabled={switchingModel || modelConfig.model === model.id}
                                    className={`w-full p-2 rounded text-left text-xs transition-all ${modelConfig.model === model.id
                                      ? 'bg-indigo-500/10 dark:bg-indigo-500/10 bg-pink-100/50 text-indigo-400 dark:text-indigo-400 text-pink-600'
                                      : 'hover:bg-[rgba(255,255,255,0.03)] dark:hover:bg-[rgba(255,255,255,0.03)] hover:bg-pink-50/50 text-[#94a3b8] dark:text-[#94a3b8] text-gray-600'
                                      }`}
                                  >
                                    {model.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  adjustTextareaHeight()
                }}
                onKeyDown={handleKeyDown}
                placeholder={sources.length === 0 ? 'Ask me anything! Add sources for cited answers...' : 'Ask anything about your sources...'}
                disabled={isLoading}
                rows={1}
                className="min-h-[44px] max-h-32 flex-1 resize-none bg-transparent px-2 py-2.5 text-sm text-pink-800 outline-none placeholder-pink-400/60 dark:text-white dark:placeholder-[#64748b] md:text-base"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 dark:from-indigo-500 dark:to-purple-600 from-pink-500 to-rose-500 p-2.5 text-white transition-all disabled:cursor-not-allowed disabled:opacity-50 hover:shadow-lg hover:shadow-indigo-500/25 dark:hover:shadow-indigo-500/25 hover:shadow-pink-500/25"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
          <p className="mt-2 hidden text-center text-xs text-[#64748b] dark:text-[#64748b] text-pink-600/70 lg:block">
            Press Enter to send, Shift + Enter for new line • Ctrl/Cmd + K to focus • Ctrl/Cmd + N for new chat • Ctrl/Cmd + F to search • Ctrl/Cmd + E to export
          </p>
        </form>

        <ConfirmDialog
          open={!!confirmDialog}
          title={confirmDialog?.title || ''}
          description={confirmDialog?.description}
          confirmText={confirmDialog?.confirmText}
          destructive={confirmDialog?.destructive}
          onConfirm={confirmDialog?.onConfirm || (() => {})}
          onClose={() => setConfirmDialog(null)}
        />
      </div>
    </div>
  )
}

function WelcomeScreen({ sources, sourcesLoading, onAddSource }: { sources: Source[]; sourcesLoading: boolean; onAddSource: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="relative mb-8">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center animate-float">
          <Sparkles className="w-10 h-10 text-white" />
        </div>
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 blur-2xl opacity-40" />
      </div>

      <h2 className="text-2xl md:text-3xl font-bold mb-4">
        <span className="gradient-text">Ask Anything</span>
      </h2>

      <p className="text-[#94a3b8] dark:text-[#94a3b8] text-pink-700/80 max-w-md mb-8">
        {sourcesLoading
          ? 'Loading your sources...'
          : sources.length === 0
            ? 'Start chatting! Add sources like GitHub repos, PDFs, or URLs for answers with citations.'
            : `You have ${sources.length} source${sources.length > 1 ? 's' : ''} loaded. Ask me anything!`
        }
      </p>

      {!sourcesLoading && sources.length === 0 && (
        <div className="flex gap-3">
          <button onClick={onAddSource} className="btn-primary">
            <Plus className="w-4 h-4" />
            Add Source
          </button>
        </div>
      )}

      {!sourcesLoading && sources.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full">
          {[
            { icon: '📚', title: 'Learn Faster', desc: 'Get instant answers from your materials' },
            { icon: '🔍', title: 'Find Citations', desc: 'Every answer includes source references' },
            { icon: '💡', title: 'Ask Anything', desc: 'Code, concepts, or implementation details' },
          ].map((item, i) => (
            <div key={i} className="card text-left">
              <div className="text-3xl mb-3">{item.icon}</div>
              <h3 className="font-semibold text-white mb-1">{item.title}</h3>
              <p className="text-sm text-[#94a3b8] dark:text-[#94a3b8] text-pink-700/80">{item.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface MessageBubbleProps {
  message: Message
  isEditing?: boolean
  editingContent?: string
  onEditContentChange?: (content: string) => void
  onSaveEdit?: () => void
  onCancelEdit?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onRegenerate?: () => void
  onCopy?: (content: string) => void
  onRetry?: () => void
  canRegenerate?: boolean
  isRegenerating?: boolean
  highlightText?: string
}

function MessageBubble({
  message,
  isEditing = false,
  editingContent = '',
  onEditContentChange,
  onSaveEdit,
  onCancelEdit,
  onEdit,
  onDelete,
  onRegenerate,
  onCopy,
  onRetry,
  canRegenerate = false,
  isRegenerating = false,
  highlightText = ''
}: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const [showCitations, setShowCitations] = useState(false)
  const [showActions, setShowActions] = useState(false)

  if (message.error) {
    return (
      <div className="flex gap-4 fade-in">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center flex-shrink-0">
          <X className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 max-w-[80%]">
          <div className="inline-block rounded-2xl px-5 py-3 bg-red-500/10 border border-red-500/30">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-red-400 font-semibold text-sm">Error</span>
            </div>
            <p className="text-red-300 text-sm mb-3">{message.errorMessage || 'An error occurred'}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="text-xs px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg transition-colors text-red-300"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const highlightTextInContent = (content: string, query: string) => {
    if (!query) return content
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const parts = content.split(new RegExp(`(${escapedQuery})`, 'gi'))
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-yellow-500/30 text-yellow-200">{part}</mark>
      ) : (
        part
      )
    )
  }

  return (
    <div className={`group flex items-start gap-3 fade-in ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${isUser
          ? 'bg-gradient-to-br from-cyan-500 to-blue-600 dark:from-cyan-500 dark:to-blue-600 from-pink-400 to-rose-500'
          : 'bg-gradient-to-br from-purple-500 to-pink-600 dark:from-purple-500 dark:to-pink-600 from-pink-300 to-rose-400'
          }`}
      >
        {isUser ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
      </div>

      {/* Message */}
      <div className={`min-w-0 ${isUser ? 'ml-auto max-w-[82%] text-right' : 'flex-1 max-w-[min(100%,60rem)]'}`}>
        <div className="relative">
          {isEditing ? (
            <div className="rounded-2xl px-5 py-3 message-user">
              <textarea
                value={editingContent}
                onChange={(e) => onEditContentChange?.(e.target.value)}
                className="w-full bg-transparent text-white dark:text-white text-gray-800 resize-none outline-none"
                rows={3}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    onSaveEdit?.()
                  }
                  if (e.key === 'Escape') {
                    onCancelEdit?.()
                  }
                }}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={onSaveEdit}
                  className="text-xs px-3 py-1 bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={onCancelEdit}
                  className="text-xs px-3 py-1 bg-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.2)] rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div
                className={`relative rounded-2xl px-5 py-3 ${isUser ? 'inline-block message-user text-white dark:text-white' : 'block w-full message-ai text-gray-800 text-white/90 dark:text-white/90'
                  }`}
                onMouseEnter={() => setShowActions(true)}
                onMouseLeave={() => setShowActions(false)}
              >
                {isUser ? (
                  <p className="whitespace-pre-wrap">
                    {highlightText ? highlightTextInContent(message.content, highlightText) : message.content}
                  </p>
                ) : (
                  <MarkdownMessage content={message.content} highlightQuery={highlightText} highlighter={highlightTextInContent} />
                )}

                {/* Message Actions */}
                {showActions && (
                  <div className={`absolute top-2 ${isUser ? 'left-2' : 'right-2'} flex gap-1 bg-[#0a0a0f]/90 dark:bg-[#0a0a0f]/90 bg-white/90 backdrop-blur-sm rounded-lg p-1 border border-[rgba(255,255,255,0.1)] dark:border-[rgba(255,255,255,0.1)] border-pink-200/30`}>
                    {onCopy && (
                      <button
                        onClick={() => onCopy(message.content)}
                        className="p-1.5 rounded hover:bg-[rgba(255,255,255,0.1)] transition-colors"
                        title="Copy"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {isUser && onEdit && (
                      <button
                        onClick={onEdit}
                        className="p-1.5 rounded hover:bg-[rgba(255,255,255,0.1)] transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {!isUser && canRegenerate && onRegenerate && (
                      <button
                        onClick={onRegenerate}
                        disabled={isRegenerating}
                        className="p-1.5 rounded hover:bg-[rgba(255,255,255,0.1)] transition-colors disabled:opacity-50"
                        title="Regenerate"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={onDelete}
                        className="p-1.5 rounded hover:bg-red-500/20 text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Citations */}
        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="mt-3 text-left">
            <button
              onClick={() => setShowCitations(!showCitations)}
              className="flex items-center gap-2 text-xs text-indigo-400 dark:text-indigo-400 text-pink-600 hover:text-indigo-300 dark:hover:text-indigo-300 hover:text-pink-700 transition-colors group"
            >
              <FileCode className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span className="font-medium">
                {message.citations.length} citation{message.citations.length > 1 ? 's' : ''}
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showCitations ? 'rotate-180' : ''}`} />
            </button>

            {showCitations && (
              <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-2">
                {message.citations.map((citation, i) => (
                  <div
                    key={i}
                    className="citation-card group/citation bg-[rgba(99,102,241,0.05)] dark:bg-[rgba(99,102,241,0.05)] bg-pink-50/80 border border-indigo-500/20 dark:border-indigo-500/20 border-pink-200/50 rounded-lg p-3 hover:border-indigo-500/40 dark:hover:border-indigo-500/40 hover:border-pink-400/60 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="flex-shrink-0 w-6 h-6 rounded bg-indigo-500/20 dark:bg-indigo-500/20 bg-pink-200/50 flex items-center justify-center text-xs font-semibold text-indigo-400 dark:text-indigo-400 text-pink-600">
                          {i + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-indigo-300 dark:text-indigo-300 text-pink-600 truncate">
                              {citation.source}
                            </span>
                            {citation.line && (
                              <span className="text-xs text-[#94a3b8] dark:text-[#94a3b8] text-pink-600/70 bg-[rgba(255,255,255,0.05)] dark:bg-[rgba(255,255,255,0.05)] bg-pink-100/50 px-2 py-0.5 rounded">
                                Line {citation.line}
                              </span>
                            )}
                            {citation.page && (
                              <span className="text-xs text-[#94a3b8] dark:text-[#94a3b8] text-pink-600/70 bg-[rgba(255,255,255,0.05)] dark:bg-[rgba(255,255,255,0.05)] bg-pink-100/50 px-2 py-0.5 rounded">
                                Page {citation.page}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => onCopy?.(citation.content)}
                        className="opacity-0 group-hover/citation:opacity-100 transition-opacity p-1 hover:bg-[rgba(255,255,255,0.1)] rounded"
                        title="Copy citation"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="pl-8">
                      <p className="text-xs text-[#94a3b8] dark:text-[#94a3b8] text-pink-700/80 leading-relaxed line-clamp-3 group-hover/citation:line-clamp-none transition-all">
                        {citation.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Timestamp */}
        <p className={`text-xs text-[#64748b] dark:text-[#64748b] text-pink-600/70 mt-2 ${isUser ? 'text-right' : ''}`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}


function TypingIndicator() {
  return (
    <div className="flex gap-4 fade-in">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 dark:from-purple-500 dark:to-pink-600 from-pink-300 to-rose-400 flex items-center justify-center">
        <Bot className="w-5 h-5 text-white" />
      </div>
      <div className="message-ai rounded-2xl">
        <div className="typing-indicator">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  )
}
