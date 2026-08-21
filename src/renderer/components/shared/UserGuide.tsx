import { useState, useMemo, useCallback } from 'react'
import {
  BookOpen, Rocket, Image, Wrench, FileText, Palette, Keyboard, Zap, CircleHelp,
  Lightbulb, TriangleAlert, StickyNote, type LucideIcon
} from 'lucide-react'
import DOCS, { type DocBlock } from '../../../guide/content'

const ICON_MAP: Record<string, LucideIcon> = {
  BookOpen, Rocket, Image, Wrench, FileText, Palette, Keyboard, Zap, CircleHelp,
}

function renderBlock(block: DocBlock, idx: number): React.ReactNode {
  switch (block.type) {
    case 'heading': {
      const Tag = block.level === 1 ? 'h1' : block.level === 2 ? 'h2' : 'h3'
      const cls = block.level === 1 ? 'text-lg font-bold text-zinc-100 mb-3 mt-2'
        : block.level === 2 ? 'text-sm font-semibold text-zinc-200 mb-2 mt-4'
        : 'text-xs font-medium text-zinc-300 mb-1 mt-3'
      return <Tag key={idx} className={cls}>{block.text}</Tag>
    }
    case 'paragraph':
      return <p key={idx} className="text-xs text-zinc-400 leading-relaxed mb-2">{block.text}</p>
    case 'code':
      return (
        <pre key={idx} className="bg-zinc-900 text-zinc-300 text-[10px] p-2 rounded border border-zinc-800 mb-2 overflow-x-auto">
          <code>{block.code}</code>
        </pre>
      )
    case 'shortcuts':
      return (
        <div key={idx} className="space-y-1 mb-2">
          {block.items.map((item, si) => (
            <div key={si} className="flex items-center gap-2 text-xs text-zinc-400">
              <div className="flex gap-0.5">
                {item.keys.map((k, ki) => (
                  <span key={ki} className="px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded text-[10px] font-mono border border-zinc-700">
                    {k}
                  </span>
                ))}
              </div>
              <span>{item.desc}</span>
            </div>
          ))}
        </div>
      )
    case 'tip':
      return (
        <div key={idx} className="bg-emerald-900/30 border border-emerald-800/40 rounded p-2 mb-2">
          <span className="text-[10px] font-semibold text-emerald-400 block mb-0.5 flex items-center gap-1"><Lightbulb className="w-3 h-3" /> Tip</span>
          <p className="text-xs text-emerald-300/80">{block.text}</p>
        </div>
      )
    case 'warning':
      return (
        <div key={idx} className="bg-amber-900/30 border border-amber-800/40 rounded p-2 mb-2">
          <span className="text-[10px] font-semibold text-amber-400 block mb-0.5 flex items-center gap-1"><TriangleAlert className="w-3 h-3" /> Warning</span>
          <p className="text-xs text-amber-300/80">{block.text}</p>
        </div>
      )
    case 'note':
      return (
        <div key={idx} className="bg-sky-900/30 border border-sky-800/40 rounded p-2 mb-2">
          <span className="text-[10px] font-semibold text-sky-400 block mb-0.5 flex items-center gap-1"><StickyNote className="w-3 h-3" /> Note</span>
          <p className="text-xs text-sky-300/80">{block.text}</p>
        </div>
      )
    case 'bullets':
      return (
        <ul key={idx} className="list-disc list-inside text-xs text-zinc-400 space-y-0.5 mb-2">
          {block.items.map((item, bi) => <li key={bi}>{item}</li>)}
        </ul>
      )
    case 'steps':
      return (
        <ol key={idx} className="list-decimal list-inside text-xs text-zinc-400 space-y-1 mb-2">
          {block.items.map((item, bi) => <li key={bi}>{item}</li>)}
        </ol>
      )
    case 'image':
      return (
        <figure key={idx} className="mb-2">
          <img src={block.src} alt={block.alt} className="max-w-full rounded border border-zinc-800" />
          {block.caption && <figcaption className="text-[10px] text-zinc-400 mt-1 text-center">{block.caption}</figcaption>}
        </figure>
      )
    case 'link':
      return null
    default:
      return null
  }
}

export default function UserGuide() {
  const [search, setSearch] = useState('')
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => new Set(DOCS.map((s) => s.id)))
  const [currentPage, setCurrentPage] = useState<{ sectionId: string; pageId: string }>({
    sectionId: DOCS[0]?.id || '',
    pageId: DOCS[0]?.pages[0]?.id || ''
  })
  const [breadcrumb, setBreadcrumb] = useState<{ sectionId: string; pageId: string; title: string }[]>([])

  const toggleSection = useCallback((id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const navigateTo = useCallback((sectionId: string, pageId: string) => {
    setCurrentPage({ sectionId, pageId })
    const section = DOCS.find((s) => s.id === sectionId)
    const page = section?.pages.find((p) => p.id === pageId)
    if (section && page) {
      setBreadcrumb((prev) => {
        const filtered = prev.filter((b) => !(b.sectionId === sectionId && b.pageId === pageId))
        return [...filtered, { sectionId, pageId, title: page.title }]
      })
    }
  }, [])

  const filteredDocs = useMemo(() => {
    if (!search.trim()) return DOCS
    const q = search.toLowerCase()
    return DOCS.map((section) => ({
      ...section,
      pages: section.pages.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.content.some(
            (c) => (c.type === 'paragraph' && c.text.toLowerCase().includes(q)) ||
              (c.type === 'bullets' && c.items.some((i) => i.toLowerCase().includes(q))) ||
              (c.type === 'steps' && c.items.some((i) => i.toLowerCase().includes(q)))
          )
      )
    })).filter((s) => s.pages.length > 0)
  }, [search])

  const currentSection = DOCS.find((s) => s.id === currentPage.sectionId)
  const currentPageData = currentSection?.pages.find((p) => p.id === currentPage.pageId)

  // Build prev/next navigation
  const allPages = DOCS.flatMap((s) => s.pages.map((p) => ({ sectionId: s.id, pageId: p.id })))
  const currentIdx = allPages.findIndex((p) => p.sectionId === currentPage.sectionId && p.pageId === currentPage.pageId)
  const prevPage = currentIdx > 0 ? allPages[currentIdx - 1] : null
  const nextPage = currentIdx < allPages.length - 1 ? allPages[currentIdx + 1] : null

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-zinc-300 overflow-hidden">
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800 flex-shrink-0">
        <h1 className="text-sm font-semibold text-zinc-100">Mockup Studio Guide</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.close()}
            className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 flex-shrink-0 bg-zinc-900/50 border-r border-zinc-800 flex flex-col overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-zinc-800">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documentation…"
              className="w-full px-2 py-1 text-[11px] bg-zinc-800 text-zinc-300 rounded border border-zinc-700 focus:border-indigo-500 outline-none placeholder-zinc-500"
            />
          </div>

          {/* Section tree */}
          <nav className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredDocs.map((section) => (
              <div key={section.id}>
                <button
                  onClick={() => toggleSection(section.id)}
                  className="flex items-center gap-1.5 w-full text-left px-1.5 py-1 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 rounded transition-colors"
                >
                  <span className="text-[10px]">{expandedSections.has(section.id) ? '▾' : '▸'}</span>
                   <span>{(() => { const Icon = ICON_MAP[section.icon]; return Icon ? <Icon className="w-3 h-3 inline" /> : null })()}</span>
                  <span>{section.title}</span>
                </button>
                {expandedSections.has(section.id) && (
                  <div className="ml-4 space-y-0.5 mt-0.5">
                    {section.pages.map((page) => {
                      const isActive = currentPage.sectionId === section.id && currentPage.pageId === page.id
                      const hasMatch = search.trim() && page.title.toLowerCase().includes(search.toLowerCase())
                      return (
                        <button
                          key={page.id}
                          onClick={() => navigateTo(section.id, page.id)}
                          className={`block w-full text-left px-2 py-0.5 text-[11px] rounded transition-colors ${
                            isActive
                              ? 'bg-indigo-600/20 text-indigo-300'
                              : hasMatch
                                ? 'text-amber-300 hover:text-zinc-200'
                                : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          {highlightMatch(page.title, search)}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
            {filteredDocs.length === 0 && (
              <p className="text-[11px] text-zinc-400 text-center py-4">No results found.</p>
            )}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-4">
            {/* Breadcrumb */}
            {breadcrumb.length > 0 && (
              <nav className="flex items-center gap-1 text-[10px] text-zinc-400 mb-4 flex-wrap">
                {breadcrumb.map((b, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <span className="text-zinc-700">/</span>}
                    <button
                      onClick={() => navigateTo(b.sectionId, b.pageId)}
                      className="hover:text-zinc-300 transition-colors"
                    >
                      {b.title}
                    </button>
                  </span>
                ))}
              </nav>
            )}

            {/* Page content */}
            {currentPageData ? (
              <div>
                {currentPageData.content.map((block, idx) => renderBlock(block, idx))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-sm text-zinc-400">Select a topic from the sidebar to get started.</p>
              </div>
            )}

            {/* Prev / Next navigation */}
            <div className="flex items-center justify-between mt-8 pt-4 border-t border-zinc-800">
              {prevPage ? (
                <button
                  onClick={() => navigateTo(prevPage.sectionId, prevPage.pageId)}
                  className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  ← Previous
                </button>
              ) : <div />}
              {nextPage ? (
                <button
                  onClick={() => navigateTo(nextPage.sectionId, nextPage.pageId)}
                  className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Next →
                </button>
              ) : <div />}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-amber-600/30 text-amber-200 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

