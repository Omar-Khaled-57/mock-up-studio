/**
 * Scene — the main composition canvas.
 * Contains editable title/slogan text and three draggable device mockups
 * (Monitor, iPad, Phone) arranged in a layered layout.
 */
import DraggableDevice from './DraggableDevice';
import DraggableTextOverlay from './DraggableTextOverlay';
import EditableText from './EditableText';
import Monitor from './Monitor';
import Ipad from './Ipad';
import Phone from './Phone';

export default function Scene({ textGlow, titleShadow, overflow, titleSize, sloganSize, textBoxes = [], removeTextBox, updateTextBox }) {
  return (
    <>
      {/* ── Left-side editable text block ── */}
      <div
        className="absolute left-[5%] top-1/2 -translate-y-1/2 w-[30%] z-10 flex flex-col gap-[10px]"
        style={{ pointerEvents: 'none' }}
      >
        <EditableText
          as="h1"
          placeholder="YOUR TITLE"
          initial="ANALYTICAL<br>DATA COLLECTION"
          fontSize={`${titleSize}px`}
          className={`font-inter font-black leading-[1.05] tracking-[-0.02em] outline-none cursor-text pb-[4px] ${textGlow ? 'title-glow' : 'text-white'} ${titleShadow ? 'title-shadow' : ''}`}
          style={{ pointerEvents: 'auto', wordBreak: 'break-word' }}
        />
        <EditableText
          as="p"
          placeholder="Your slogan goes here"
          initial="Powerful insights at your fingertips. Collect, analyze, and visualize your data."
          fontSize={`${sloganSize}px`}
          className="font-inter text-white/70 leading-[1.5] outline-none cursor-text pb-[4px]"
          style={{ pointerEvents: 'auto', fontWeight: 400 }}
        />
      </div>

      {/* ── Devices layer ── */}
      <div className="devices absolute inset-0 z-[2]">
        <DraggableDevice
          className="z-[2]"
          overflow={overflow}
          defaultStyle={{ position: 'absolute', right: '2%', bottom: 0, width: '56%' }}
        >
          <Monitor />
        </DraggableDevice>
        <DraggableDevice
          className="z-[4]"
          overflow={overflow}
          defaultStyle={{ position: 'absolute', right: '26%', bottom: 0, width: '24%' }}
        >
          <Ipad />
        </DraggableDevice>
        <DraggableDevice
          className="z-[6]"
          overflow={overflow}
          defaultStyle={{ position: 'absolute', right: '14%', bottom: 0, width: '13%' }}
        >
          <Phone />
        </DraggableDevice>
      </div>

      {/* ── Draggable text overlays ── */}
      {textBoxes.map(tb => (
        <DraggableTextOverlay
          key={tb.id}
          {...tb}
          onDelete={() => removeTextBox(tb.id)}
          onUpdate={(patch) => updateTextBox(tb.id, patch)}
        />
      ))}
    </>
  );
}
