import { useState, useCallback } from 'react'
import { useStore } from '../../store'
import { buildTextStyle } from '../../lib/device-utils'
import InlineEditor from './InlineEditor'

export default function TitleBlock() {
  const titleText = useStore((s) => s.scenes[s.activeSceneIndex].titleText)
  const sloganText = useStore((s) => s.scenes[s.activeSceneIndex].sloganText)
  const updateTitleText = useStore((s) => s.updateTitleText)
  const updateSloganText = useStore((s) => s.updateSloganText)
  const pushHistory = useStore((s) => s.pushHistory)

  const [editingTitle, setEditingTitle] = useState(false)
  const [editingSlogan, setEditingSlogan] = useState(false)

  const handleTitleCommit = useCallback(
    (text: string) => {
      updateTitleText({ content: text })
      pushHistory('Edit title')
    },
    [updateTitleText, pushHistory]
  )

  const handleSloganCommit = useCallback(
    (text: string) => {
      updateSloganText({ content: text })
      pushHistory('Edit slogan')
    },
    [updateSloganText, pushHistory]
  )

  return (
    <div
      style={{
        position: 'absolute',
        left: 60,
        top: 60,
        zIndex: 1000,
        pointerEvents: 'auto',
        maxWidth: '50%'
      }}
    >
      <InlineEditor
        content={titleText.content}
        isEditing={editingTitle}
        onCommit={handleTitleCommit}
        onStartEdit={() => setEditingTitle(true)}
        onStopEdit={() => setEditingTitle(false)}
        style={buildTextStyle(titleText)}
        placeholder="Your Title"
      />
      <InlineEditor
        content={sloganText.content}
        isEditing={editingSlogan}
        onCommit={handleSloganCommit}
        onStartEdit={() => setEditingSlogan(true)}
        onStopEdit={() => setEditingSlogan(false)}
        style={{
          ...buildTextStyle(sloganText),
          marginTop: 12
        }}
        placeholder="Your slogan goes here"
      />
    </div>
  )
}
