/**
 * Text wrap — the InlineEditor enforces `whiteSpace` from the text box's
 * `wrap` flag (pre-wrap default, nowrap + ellipsis when off) and the
 * TextPanel exposes a toggle wired to the selected text box.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import InlineEditor from '../renderer/components/text/InlineEditor'
import TextBox from '../renderer/components/text/TextBox'
import TextPanel from '../renderer/components/sidebar/TextPanel'
import { resetStore, makeTextBox } from './helpers'
import { useStore } from '../renderer/store'

function renderEditor(wrap: boolean): HTMLElement {
  const { container } = render(
    <InlineEditor
      content="Hello"
      isEditing={false}
      onCommit={() => {}}
      onStopEdit={() => {}}
      wrap={wrap}
    />
  )
  return container.querySelector('div') as HTMLElement
}

describe('InlineEditor wrap', () => {
  it('renders pre-wrap when wrap is on (default)', () => {
    expect(renderEditor(true).style.whiteSpace).toBe('pre-wrap')
  })

  it('renders nowrap + ellipsis when wrap is off', () => {
    const editor = renderEditor(false)
    expect(editor.style.whiteSpace).toBe('nowrap')
    expect(editor.style.textOverflow).toBe('ellipsis')
  })
})

describe('TextBox wrap', () => {
  beforeEach(() => resetStore())

  it('passes the wrap flag through to the editor', () => {
    const { container } = render(<TextBox textBox={makeTextBox({ wrap: false })} />)
    const editor = container.querySelector('[data-element-id] > div') as HTMLElement
    expect(editor).toBeTruthy()
    expect(editor.style.whiteSpace).toBe('nowrap')
  })
})

describe('TextPanel wrap toggle', () => {
  beforeEach(() => resetStore())

  it('patches wrap on the selected text box', () => {
    useStore.getState().addTextBox(makeTextBox({ id: 'tb-w', wrap: true }))
    act(() => useStore.getState().select('tb-w'))

    render(<TextPanel />)
    expect(screen.getByText('Wrap text')).toBeTruthy()

    fireEvent.click(screen.getByRole('switch'))
    expect(useStore.getState().scenes[0].textBoxes.find((t) => t.id === 'tb-w')?.wrap).toBe(false)

    cleanup()
  })
})
