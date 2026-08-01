import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, ChevronRight, X } from 'lucide-react'
import { useStore } from '../../store'
import { safeScene } from '../../store/sceneSlice'
import { useRuntimeStore } from '../../runtime/store'
import { getFocusPath } from '../../services/focus'
import { toolManager, toolRegistry, toolsInGroup, isToolReachable, Tool, ToolGroup } from '../../tools'
import { useTheme } from '../../hooks/useTheme'
import ToolButton from './ToolButton'

const GROUP_ORDER: { group: ToolGroup; label: string }[] = [
  { group: 'select', label: 'Select' },
  { group: 'brush', label: 'Brush' },
  { group: 'eraser', label: 'Eraser' },
  { group: 'mask', label: 'Mask' }
]

export default function BottomToolbar() {
  const activeToolId = useRuntimeStore((s) => s.activeToolId)
  const temporaryToolStack = useRuntimeStore((s) => s.temporaryToolStack)
  const focusGroupId = useRuntimeStore((s) => s.focusGroupId)
  const enterFocus = useRuntimeStore((s) => s.enterFocus)
  const exitFocus = useRuntimeStore((s) => s.exitFocus)
  const scene = useStore(safeScene)
  const { clsx, bg, text, border } = useTheme()
  const [toolsVisible, setToolsVisible] = useState(true)

  const effectiveToolId =
    temporaryToolStack.length > 0 ? temporaryToolStack[temporaryToolStack.length - 1].toolId : activeToolId
  const activeTool = toolRegistry.get(effectiveToolId)

  const focusPath = useMemo(() => getFocusPath(scene, focusGroupId), [scene, focusGroupId])

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

  return (
    <div className={clsx("border-t w-full min-w-0", bg.surface)}>
      {/* Header strip (SceneTabs-style): active tool + collapse toggle on the
          left, focus breadcrumb pinned to the right. */}
      <div className="flex items-center gap-2 px-2">
        <button
          type="button"
          aria-label="Show or hide tools"
          aria-expanded={toolsVisible}
          onClick={() => setToolsVisible((v) => !v)}
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
          {toolsVisible ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        </button>

        <div className="flex-1" />

        {focusGroupId && (
          <div
            data-focus-breadcrumb
            className={clsx("flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg", bg.active, text.secondary)}
          >
            {focusPath.length > 0 ? (
              focusPath.map((group, index) => (
                <span key={group.id} className="flex items-center gap-1 min-w-0">
                  {index > 0 && <ChevronRight size={10} className="flex-shrink-0" />}
                  <button
                    type="button"
                    title={`Focus ${group.name}`}
                    onClick={() => enterFocus(group.id)}
                    className={clsx(
                      "truncate max-w-28 hover:underline",
                      index === focusPath.length - 1 ? "font-semibold" : text.tertiary
                    )}
                  >
                    {group.name}
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
              className={clsx("ml-1 w-4 h-4 flex items-center justify-center rounded transition-colors", bg.hover, text.muted)}
            >
              <X size={11} />
            </button>
          </div>
        )}
      </div>

      {/* Revealed tool groups (hide/reveal like the scene-tabs container). */}
      {toolsVisible && (
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
      )}
    </div>
  )
}
