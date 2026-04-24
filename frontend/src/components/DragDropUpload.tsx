'use client'

import { useState, useCallback } from 'react'
import { Upload, FileText, X } from 'lucide-react'

interface DragDropUploadProps {
  onFileSelect: (file: File) => void
  accept?: string
  disabled?: boolean
  className?: string
}

export default function DragDropUpload({
  onFileSelect,
  accept = '.pdf,.xlsx,.xls,.csv,.docx',
  disabled = false,
  className = ''
}: DragDropUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragCounter, setDragCounter] = useState(0)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragCounter(prev => prev + 1)
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }, [])

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragCounter(prev => {
      const newCounter = prev - 1
      if (newCounter === 0) {
        setIsDragging(false)
      }
      return newCounter
    })
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    setDragCounter(0)

    if (disabled) return

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const file = files[0]
      
      // Check file extension
      const allowedExtensions = accept.split(',').map(ext => ext.trim())
      const fileExt = '.' + file.name.split('.').pop()?.toLowerCase()
      
      if (allowedExtensions.includes(fileExt)) {
        onFileSelect(file)
      } else {
        alert(`Please upload a file with one of these extensions: ${accept}`)
      }
    }
  }, [disabled, accept, onFileSelect])

  return (
    <div
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className={`
        relative w-full rounded-xl border-2 border-dashed transition-all
        ${isDragging
          ? 'border-indigo-500 bg-indigo-500/10 scale-[1.02]'
          : 'border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.2)]'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
    >
      <div className="flex flex-col items-center justify-center gap-3 p-8">
        {isDragging ? (
          <>
            <div className="w-16 h-16 rounded-full bg-indigo-500/20 flex items-center justify-center animate-pulse">
              <Upload className="w-8 h-8 text-indigo-400" />
            </div>
            <p className="text-sm font-medium text-indigo-400">Drop file here</p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center">
              <FileText className="w-8 h-8 text-purple-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium mb-1">Drag & drop your file here</p>
              <p className="text-xs text-[#64748b]">
                or click to browse
              </p>
              <p className="text-xs text-[#64748b] mt-2">
                Supported: {accept.replace(/\./g, '').toUpperCase()}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
