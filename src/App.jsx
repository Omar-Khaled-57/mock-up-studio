/**
 * App — root component.
 *
 * Manages:
 *  - Gradient state (4 colours + angle) passed down to Controls
 *  - Scene ref for html2canvas export
 *  - Text boxes array (unlimited, each with id/color/content)
 *  - Export handler that dynamically loads html2canvas, hides edit hints,
 *    captures the scene at 2x resolution, and triggers a PNG download.
 */
import { useState, useRef, useCallback } from 'react';
import Controls from './components/Controls';
import Scene from './components/Scene';
import BlueCyberBg from './components/BlueCyberBg';
import QPresetBg from './components/QPresetBg';

let nextId = 1;

export default function App() {
  const [bgPreset, setBgPreset] = useState('gradient');
  const [textGlow, setTextGlow] = useState(false);
  const [titleShadow, setTitleShadow] = useState(false);
  const [gradient, setGradient] = useState({
    colors: ['#3b1fa8', '#7c2fd4', '#1a0e6e', '#0a0540'],
    angle: 135,
  });
  const [overflow, setOverflow] = useState(false);
  const [titleSize, setTitleSize] = useState(42);
  const [sloganSize, setSloganSize] = useState(16);
  const [textBoxes, setTextBoxes] = useState([]);
  const [nextTextColor, setNextTextColor] = useState('#ffffff');

  const sceneRef = useRef(null);

  const addTextBox = useCallback(() => {
    const id = nextId++;
    setTextBoxes(prev => [
      ...prev,
      { id, color: nextTextColor, content: 'Your text', bgVisible: true, stylePreset: 'custom', fontSize: 28 },
    ]);
  }, [nextTextColor]);

  const removeTextBox = useCallback((id) => {
    setTextBoxes(prev => prev.filter(t => t.id !== id));
  }, []);

  const updateTextBox = useCallback((id, patch) => {
    setTextBoxes(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  /** Dynamically load html2canvas, hide transient UI, capture & download. */
  const handleExport = useCallback(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload = () => {
      const el = sceneRef.current;
      if (!el) return;

      // Hide transient UI before capture
      const hints = el.querySelectorAll('.edit-hint');
      hints.forEach(h => (h.style.display = 'none'));

      // Remove data-placeholder so empty content doesn't show pseudo text
      const placeholders = el.querySelectorAll('[data-placeholder]');
      const origPlaceholders = [];
      placeholders.forEach(p => {
        origPlaceholders.push(p.getAttribute('data-placeholder'));
        p.removeAttribute('data-placeholder');
      });

      html2canvas(el, { 
        scale: 2, 
        useCORS: true, 
        backgroundColor: null, 
        logging: false,
        onclone: (doc) => {
          // html2canvas struggles with background-clip: text, so we fallback to a solid color
          const glowingText = doc.querySelectorAll('.title-glow');
          glowingText.forEach(node => {
            node.style.background = 'none';
            node.style.webkitBackgroundClip = 'initial';
            node.style.backgroundClip = 'initial';
            node.style.color = '#3ca3ff';
            node.style.webkitTextFillColor = '#3ca3ff';
          });
        }
      })
        .then(canvas => {
          const link = document.createElement('a');
          link.download = 'device-mockup.png';
          link.href = canvas.toDataURL('image/png');
          link.click();

          // Restore all transient changes
          hints.forEach(h => (h.style.display = ''));
          placeholders.forEach((p, i) => p.setAttribute('data-placeholder', origPlaceholders[i]));
        });
    };
    document.head.appendChild(script);
  }, []);

  return (
    <>
      <Controls
        bgPreset={bgPreset}
        setBgPreset={setBgPreset}
        textGlow={textGlow}
        setTextGlow={setTextGlow}
        titleShadow={titleShadow}
        setTitleShadow={setTitleShadow}
        gradient={gradient}
        setGradient={setGradient}
        overflow={overflow}
        setOverflow={setOverflow}
        titleSize={titleSize}
        setTitleSize={setTitleSize}
        sloganSize={sloganSize}
        setSloganSize={setSloganSize}
        nextTextColor={nextTextColor}
        setNextTextColor={setNextTextColor}
        addTextBox={addTextBox}
        onExport={handleExport}
      />
      <main className="w-full flex-1 flex items-center justify-center px-6 py-10 md:py-14">
        <div
          ref={sceneRef}
          className={`scene relative w-full max-w-[960px] aspect-video rounded-[18px] overflow-hidden shadow-[0_40px_120px_rgba(0,0,0,.75)] preset-${bgPreset}`}
          style={{
            background: bgPreset === 'gradient' ? `linear-gradient(${gradient.angle}deg, ${gradient.colors.join(', ')})` : bgPreset === 'q-preset' ? 'transparent' : '#05080c',
          }}
        >
          {bgPreset === 'blue-cyber' && <BlueCyberBg />}
          {bgPreset === 'q-preset' && <QPresetBg />}
          <span className="edit-hint">&#9998; click title / slogan to edit</span>
          <Scene textGlow={textGlow} titleShadow={titleShadow} overflow={overflow} titleSize={titleSize} sloganSize={sloganSize} textBoxes={textBoxes} removeTextBox={removeTextBox} updateTextBox={updateTextBox} />
        </div>
      </main>
    </>
  );
}
