'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

type Highlighter = (content: string, query: string) => React.ReactNode

function mapAndHighlight(children: React.ReactNode, highlightQuery?: string, highlighter?: Highlighter) {
  if (!highlightQuery || !highlighter) return children
  return React.Children.map(children, (child) => {
    if (typeof child === 'string') return highlighter(child, highlightQuery)
    return child
  })
}

type ParsedBlock =
  | { type: 'markdown'; content: string }
  | { type: 'table'; header: string[]; rows: string[][] }

function normalizeTableCell(cell: string) {
  return cell.trim().replace(/^\*\*(.+)\*\*$/, '$1')
}

function looksLikeTableHeaderSeparator(line: string) {
  // Examples:
  // | --- | --- |
  // | :-- | --: |
  const cleaned = line.trim()
  if (!cleaned.includes('-') || !cleaned.includes('|')) return false
  return /^\|?(\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?$/.test(cleaned)
}

function splitRow(line: string) {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return trimmed.split('|').map(normalizeTableCell)
}

function splitTabRow(line: string) {
  return line.split('\t').map(normalizeTableCell)
}

function parseMarkdownWithTables(content: string): ParsedBlock[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const blocks: ParsedBlock[] = []
  let buffer: string[] = []
  let inFence = false

  const flushBuffer = () => {
    const md = buffer.join('\n').trimEnd()
    if (md) blocks.push({ type: 'markdown', content: md })
    buffer = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const next = i + 1 < lines.length ? lines[i + 1] : ''

    const trimmed = line.trim()
    if (trimmed.startsWith('```')) {
      inFence = !inFence
      buffer.push(line)
      continue
    }
    if (inFence) {
      buffer.push(line)
      continue
    }

    const isPotentialHeader = line.includes('|') && line.split('|').length >= 3
    if (isPotentialHeader && looksLikeTableHeaderSeparator(next)) {
      flushBuffer()

      const header = splitRow(line)
      const rows: string[][] = []

      i += 1 // skip separator
      while (i + 1 < lines.length) {
        const rowLine = lines[i + 1]
        if (!rowLine.trim()) break
        if (!rowLine.includes('|') || rowLine.split('|').length < 3) break
        rows.push(splitRow(rowLine))
        i += 1
      }

      blocks.push({ type: 'table', header, rows })
      continue
    }

    const isPotentialTabRow = line.includes('\t') && line.split('\t').length >= 3
    if (isPotentialTabRow) {
      const rows: string[][] = [splitTabRow(line)]
      let nextIndex = i + 1

      while (nextIndex < lines.length) {
        const rowLine = lines[nextIndex]
        if (!rowLine.trim()) break
        if (!rowLine.includes('\t') || rowLine.split('\t').length < 3) break
        rows.push(splitTabRow(rowLine))
        nextIndex += 1
      }

      if (rows.length >= 2) {
        flushBuffer()
        blocks.push({ type: 'table', header: [], rows })
        i = nextIndex - 1
        continue
      }
    }

    buffer.push(line)
  }

  flushBuffer()
  return blocks
}

export default function MarkdownMessage({
  content,
  highlightQuery,
  highlighter,
}: {
  content: string
  highlightQuery?: string
  highlighter?: Highlighter
}) {
  const blocks = parseMarkdownWithTables(content)

  return (
    <div className="markdown max-w-none text-left">
      {blocks.map((block, idx) => {
        if (block.type === 'table') {
          const colCount = Math.max(block.header.length, ...(block.rows.length ? block.rows.map((r) => r.length) : [0]))
          const normalizeRow = (r: string[]) => [...r, ...Array(Math.max(0, colCount - r.length)).fill('')]
          const hasHeader = block.header.length > 0

          return (
            <div key={`t-${idx}`} className="markdown-table-wrap">
              <table className="markdown-table">
                {hasHeader && (
                  <thead>
                    <tr>
                      {normalizeRow(block.header).map((cell, i) => (
                        <th key={i}>{highlightQuery && highlighter ? highlighter(cell, highlightQuery) : cell}</th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody>
                  {block.rows.map((row, rIdx) => (
                    <tr key={rIdx}>
                      {normalizeRow(row).map((cell, cIdx) => (
                        <td key={cIdx} className={!hasHeader && cIdx === 0 ? 'markdown-table-lead' : undefined}>
                          {highlightQuery && highlighter ? highlighter(cell, highlightQuery) : cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }

        return (
          <ReactMarkdown
            key={`m-${idx}`}
            components={{
              a: ({ children, href }) => (
                <a href={href} target="_blank" rel="noreferrer noopener" className="markdown-link">
                  {mapAndHighlight(children, highlightQuery, highlighter)}
                </a>
              ),
              p: ({ children }) => <p>{mapAndHighlight(children, highlightQuery, highlighter)}</p>,
              li: ({ children }) => <li>{mapAndHighlight(children, highlightQuery, highlighter)}</li>,
              blockquote: ({ children }) => <blockquote>{children}</blockquote>,
              code({ inline, className, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || '')
                if (!inline && match) {
                  return (
                    <SyntaxHighlighter
                      style={vscDarkPlus}
                      language={match[1]}
                      PreTag="div"
                      className="rounded-xl"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  )
                }
                return (
                  <code className="markdown-inline-code" {...props}>
                    {children}
                  </code>
                )
              },
            }}
          >
            {block.content}
          </ReactMarkdown>
        )
      })}
    </div>
  )
}
