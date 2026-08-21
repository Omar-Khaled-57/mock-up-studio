import { useMemo } from 'react'
import { TextBox as TextBoxType } from '@shared/types'
import { useStore } from '../../store'
import { useRuntimeStore } from '../../runtime/store'
import { buildTextStyle } from '../../lib/device-utils'
import { useInstanceMirror } from '../../lib/component-utils'
import InlineEditor from './InlineEditor'
import ElementFacade from '../../elements/ElementFacade'
import RenameOverlay from '../../elements/RenameOverlay'

interface Props {
  textBox: TextBoxType
}

export default function TextBox({ textBox: raw }: Props) {
  const textBox = useInstanceMirror(raw)
  const editing = useRuntimeStore((s) => s.editing)

  const isEditingText = editing?.id === textBox.id && editing.mode === 'text'
  const isRenaming = editing?.id === textBox.id && editing.mode === 'rename'

  const handleContentCommit = (text: string) => {
    const state = useStore.getState()
    state.pushHistory('Edit text')
    state.updateTextBox(textBox.id, { content: text })
  }

  const handleStopEdit = () => {
    useRuntimeStore.getState().setEditing(null)
  }

  const commitRename = (value: string) => {
    const state = useStore.getState()
    state.pushHistory('Rename')
    state.updateTextBox(textBox.id, { name: value })
    useRuntimeStore.getState().setEditing(null)
  }

  const cancelRename = () => {
    useRuntimeStore.getState().setEditing(null)
  }

  const outerStyle = useMemo(
    () =>
      ({
        position: 'absolute' as const,
        left: textBox.x,
        top: textBox.y,
        width: textBox.width,
        height: textBox.heightAuto ? undefined : textBox.height,
        background: textBox.backgroundVisible ? textBox.backgroundColor : 'transparent',
        border: textBox.borderVisible ? `1px solid ${textBox.borderColor}` : 'none',
        borderRadius: textBox.borderRadius,
        zIndex: textBox.zIndex,
        cursor: isEditingText ? 'text' : textBox.locked ? 'default' : 'move',
        opacity: textBox.locked ? 0.8 : 1,
        padding: 4
      }),
    [textBox, isEditingText]
  )

  return (
    <ElementFacade id={textBox.id} kind="textBox" locked={textBox.locked} style={outerStyle}>
      <InlineEditor
        content={textBox.content}
        isEditing={isEditingText}
        onCommit={handleContentCommit}
        onStopEdit={handleStopEdit}
        selfStart={false}
        wrap={textBox.wrap}
        style={buildTextStyle(textBox)}
        className="w-full h-full"
        placeholder="Type here..."
      />

      {isRenaming && <RenameOverlay name={textBox.name} onCommit={commitRename} onCancel={cancelRename} />}
    </ElementFacade>
  )
}
