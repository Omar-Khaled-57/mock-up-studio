import { useMemo } from 'react'
import { ChevronDown, ChevronUp, ChevronRight, X, Undo2, Redo2, Download } from 'lucide-react'
import { useStore } from '../../store'
import { safeScene } from '../../store/sceneSlice'
import { useRuntimeStore } from '../../runtime/store'
import { getFocusBreadcrumb } from '../../services/focus'
import { toolManager, toolRegistry, toolsInGroup, isToolReachable, Tool, ToolGroup } from '../../tools'
import { useTheme } from '../../hooks/useTheme'
import { ICON } from '../../lib/icons'
import ToolButton from './ToolButton'
import ToolOptionsPanel from './ToolOptionsPanel'

const GROUP_ORDER: { group: ToolGroup; label: string }[] = [
  { group: 'select', label: 'Select' },
  { group: 'brush', label: 'Brush' },
  { group: 'blur', label: 'Blur' },
  { group: 'eraser', label: 'Eraser' },
  { group: 'mask', label: 'Mask' }
]

export default function BottomToolbar() {
  const activeToolId = useRuntimeStore((s) => s.activeToolId)
  const temporaryToolStack = useRuntimeStore((s) => s.temporaryToolStack)
  const focusGroupId = useRuntimeStore((s) => s.focusGroupId)
  const focusElementId = useRuntimeStore((s) => s.focusElementId)
  const enterFocus = useRuntimeStore((s) => s.enterFocus)
  const enterElementFocus = useRuntimeStore((s) => s.enterElementFocus)
  const exitFocus = useRuntimeStore((s) => s.exitFocus)
  const openExportModal = useRuntimeStore((s) => s.openExportModal)
  const toolbarToolsVisible = useRuntimeStore((s) => s.toolbarToolsVisible)
  const toggleToolbarTools = useRuntimeStore((s) => s.toggleToolbarTools)
  const scene = useStore(safeScene)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const canUndo = useStore((s) => s.undoStack.length > 0)
  const canRedo = useStore((s) => s.redoStack.length > 0)
  const { clsx, bg, text, border, accent } = useTheme()

  const effectiveToolId =
    temporaryToolStack.length > 0 ? temporaryToolStack[temporaryToolStack.length - 1].toolId : activeToolId
  const activeTool = toolRegistry.get(effectiveToolId)

  const focusPath = useMemo(
    () => getFocusBreadcrumb(scene, focusGroupId, focusElementId),
    [scene, focusGroupId, focusElementId]
  )

  const activate = (toolId: string) => {
    toolManager.setActiveTool(toolId)
  }

  const displayToolFor = (group: ToolGroup): Tool | undefined => {
    const groupTools = toolsInGroup(toolRegistry, group)
    return (
      groupTools.find((tool) => tool.id === effectiveToolId) ??
      // Prefer the group's first reachable tool so a face never lands on a
      // disabled stub (e.g. the eraser group's planned delete-element).
      groupTools.find((tool) => isToolReachable(tool)) ??
      groupTools[0]
    )
  }

  const iconBtn = clsx(
    "h-7 w-7 flex items-center justify-center rounded-md transition-colors shrink-0 disabled:opacity-30 disabled:cursor-not-allowed",
    bg.button,
    text.secondary
  )

  return (
    <div className={clsx("border-t w-full min-w-0", bg.surface)}>
      {/* Header strip (SceneTabs-style): active tool + collapse toggle on the
          left; focus breadcrumb, Export, and history pinned to the right. */}
      <div className="flex items-center gap-2 px-2">
        <button
          type="button"
          aria-label="Show or hide tools"
          aria-expanded={toolbarToolsVisible}
          onClick={toggleToolbarTools}
          className={clsx(
            "flex items-center gap-2 px-2 py-1.5 text-xs font-semibold rounded-lg transition-colors select-none",
            text.secondary,
            bg.hover
          )}
        >
          <span className="truncate max-w-40">{activeTool?.label ?? 'Tools'}</span>
          {activeTool?.shortcut && (
            <kbd className={clsx("text-[9px] font-medium px-1 py-0.5 rounded", bg.tertiary, text.muted)}>
              {activeTool.shortcut.toUpperCase()}
            </kbd>
          )}
          {toolbarToolsVisible ? <ChevronDown size={ICON.compact} /> : <ChevronUp size={ICON.compact} />}
        </button>

        <div className="flex-1" />

        {(focusGroupId || focusElementId) && (
          <div
            data-focus-breadcrumb
            className={clsx("flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg", bg.active, text.secondary)}
          >
            {focusPath.length > 0 ? (
              focusPath.map((crumb, index) => (
                <span key={crumb.id} className="flex items-center gap-1 min-w-0">
                  {index > 0 && <ChevronRight size={ICON.micro} className="flex-shrink-0" />}
                  <button
                    type="button"
                    title={`Focus ${crumb.name}`}
                    onClick={() =>
                      crumb.kind === 'group' ? enterFocus(crumb.id) : enterElementFocus(crumb.id)
                    }
                    className={clsx(
                      "truncate max-w-28 hover:underline",
                      index === focusPath.length - 1 ? "font-semibold" : text.tertiary
                    )}
                  >
                    {crumb.name}
                  </button>
                </span>
              ))
            ) : (
              <span className="font-semibold">Focus mode</span>
            )}
            <button
              type="button"
              aria-label="Exit focus mode"
              title="Exit focus mode (Esc)"
              onClick={exitFocus}
              className={clsx("ml-0.5 w-4 h-4 flex items-center justify-center rounded transition-colors", bg.hover, text.muted)}
            >
              <X size={ICON.micro} />
            </button>
          </div>
        )}

        <button
          type="button"
          aria-label="Undo"
          title="Undo (Ctrl+Z)"
          disabled={!canUndo}
          onClick={undo}
          className={iconBtn}
        >
          <Undo2 size={ICON.compact} strokeWidth={ICON.stroke} />
        </button>
        <button
          type="button"
          aria-label="Redo"
          title="Redo (Ctrl+Shift+Z)"
          disabled={!canRedo}
          onClick={redo}
          className={iconBtn}
        >
          <Redo2 size={ICON.compact} strokeWidth={ICON.stroke} />
        </button>

        <button
          type="button"
          onClick={openExportModal}
          className={clsx(
            "h-7 flex items-center gap-1.5 px-2.5 rounded-md text-xs font-medium transition-colors shrink-0",
            bg.button,
            accent.text,
            accent.hover
          )}
        >
          <Download size={ICON.compact} strokeWidth={ICON.stroke} />
          Export
        </button>
      </div>

      {/* Revealed tool groups (hide/reveal like the scene-tabs container). */}
      {toolbarToolsVisible && (
        <>
          <div className="flex items-center gap-1 px-2 pb-1.5 overflow-x-auto">
            {GROUP_ORDER.map(({ group, label }) => {
              const groupTools = toolsInGroup(toolRegistry, group)
              const displayTool = displayToolFor(group)
              if (!displayTool) return null
              const groupActive = activeTool?.group === group
              const hasVariants = groupTools.length > 1

              // Reveal side menu: while a group with variants is active its whole
              // tool set renders inline in a bordered rectangle so every variant
              // is visible for one-click switching (no popup flyout).
              if (groupActive && hasVariants) {
                return (
                  <div
                    key={group}
                    data-group-reveal={group}
                    className={clsx(
                      "flex items-center gap-0.5 p-0.5 rounded-lg border shrink-0",
                      bg.primary,
                      border.secondary
                    )}
                  >
                    {groupTools.map((tool) => (
                      <ToolButton
                        key={tool.id}
                        tool={tool}
                        active={tool.id === effectiveToolId}
                        disabled={!isToolReachable(tool)}
                        onClick={() => activate(tool.id)}
                      />
                    ))}
                  </div>
                )
              }

              return (
                <ToolButton
                  key={group}
                  tool={displayTool}
                  label={label}
                  active={groupActive}
                  disabled={!isToolReachable(displayTool)}
                  onClick={() => activate(displayTool.id)}
                />
              )
            })}
          </div>
          <ToolOptionsPanel />
        </>
      )}
    </div>
  )
}
