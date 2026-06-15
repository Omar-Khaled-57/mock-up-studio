/**
 * Controls — sticky toolbar with gradient colour/angle pickers, overflow toggle,
 * text-box adder with colour picker, and an Export button.
 */
import { useCallback } from 'react';

export default function Controls({
  bgPreset, setBgPreset,
  textGlow, setTextGlow,
  titleShadow, setTitleShadow,
  gradient, setGradient,
  overflow, setOverflow,
  titleSize, setTitleSize,
  sloganSize, setSloganSize,
  nextTextColor, setNextTextColor,
  addTextBox, onExport,
}) {
  const { colors, angle } = gradient;

  const updateColor = useCallback((index, value) => {
    setGradient(prev => {
      const next = [...prev.colors];
      next[index] = value;
      return { ...prev, colors: next };
    });
  }, [setGradient]);

  const updateAngle = useCallback((value) => {
    setGradient(prev => ({ ...prev, angle: Number(value) }));
  }, [setGradient]);

  return (
    <header className="w-full bg-[#16161d] border-b border-white/5 px-7 py-[14px] flex flex-wrap gap-[14px_24px] items-center sticky top-0 z-[100]">
      <div className="flex items-center gap-4 w-full mb-[-4px]">
        <h2 className="text-[11px] font-semibold tracking-[.14em] uppercase text-white/30">
          Background
        </h2>
        <select
          value={bgPreset}
          onChange={(e) => setBgPreset(e.target.value)}
          className="bg-[#2a2a3a] text-white/80 text-xs rounded border border-white/10 px-2 py-[2px] outline-none cursor-pointer"
        >
          <option value="gradient">Gradient</option>
          <option value="blue-cyber">Blue Cyber</option>
          <option value="q-preset">Q-Preset</option>
        </select>
      </div>

      {/* 4 colour pickers */}
      {bgPreset === 'gradient' && [0, 1, 2, 3].map(i => (
        <div key={i} className="flex items-center gap-2">
          <label className="text-xs text-white/45 whitespace-nowrap">Color {i + 1}</label>
          <input
            type="color"
            value={colors[i]}
            onChange={e => updateColor(i, e.target.value)}
            className="w-[34px] h-[26px] border border-white/15 rounded-[6px] bg-transparent cursor-pointer p-[2px]"
          />
        </div>
      ))}

      {/* Overflow toggle */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-white/45 whitespace-nowrap cursor-pointer select-none" htmlFor="overflow-toggle">
          Overflow
        </label>
        <button
          id="overflow-toggle"
          role="switch"
          aria-checked={overflow}
          onClick={() => setOverflow(v => !v)}
          className={`relative w-[36px] h-[20px] rounded-full border transition-colors ${
            overflow ? 'bg-[#7c2fd4] border-[#7c2fd4]' : 'bg-[#2a2a3a] border-white/15'
          }`}
        >
          <span
            className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform ${
              overflow ? 'translate-x-[16px]' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Text Glow toggle */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-white/45 whitespace-nowrap cursor-pointer select-none" htmlFor="glow-toggle">
          Text Glow
        </label>
        <button
          id="glow-toggle"
          role="switch"
          aria-checked={textGlow}
          onClick={() => setTextGlow(v => !v)}
          className={`relative w-[36px] h-[20px] rounded-full border transition-colors ${
            textGlow ? 'bg-[#7c2fd4] border-[#7c2fd4]' : 'bg-[#2a2a3a] border-white/15'
          }`}
        >
          <span
            className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform ${
              textGlow ? 'translate-x-[16px]' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Title Shadow toggle */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-white/45 whitespace-nowrap cursor-pointer select-none" htmlFor="shadow-toggle">
          Title Shadow
        </label>
        <button
          id="shadow-toggle"
          role="switch"
          aria-checked={titleShadow}
          onClick={() => setTitleShadow(v => !v)}
          className={`relative w-[36px] h-[20px] rounded-full border transition-colors ${
            titleShadow ? 'bg-[#7c2fd4] border-[#7c2fd4]' : 'bg-[#2a2a3a] border-white/15'
          }`}
        >
          <span
            className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform ${
              titleShadow ? 'translate-x-[16px]' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Divider */}
      <div className="w-[1px] h-6 bg-white/10" />

      {/* Text box: colour picker + add button */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-white/45 whitespace-nowrap">Text</label>
        <input
          type="color"
          value={nextTextColor}
          onChange={e => setNextTextColor(e.target.value)}
          className="w-[34px] h-[26px] border border-white/15 rounded-[6px] bg-transparent cursor-pointer p-[2px]"
          title="Font colour for the next text box"
        />
        <button
          onClick={addTextBox}
          className="w-[26px] h-[26px] flex items-center justify-center rounded-[6px] border border-white/15 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors text-base leading-none"
          title="Add text box"
        >
          +
        </button>
      </div>

      {/* Title size */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-white/45 whitespace-nowrap">Title</label>
        <input
          type="range"
          min="10"
          max="80"
          value={titleSize}
          onChange={e => setTitleSize(Number(e.target.value))}
          className="w-[80px] accent-[#7c2fd4]"
        />
        <span className="text-[11px] text-white/35 min-w-[24px]">{titleSize}px</span>
      </div>

      {/* Slogan size */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-white/45 whitespace-nowrap">Slogan</label>
        <input
          type="range"
          min="8"
          max="40"
          value={sloganSize}
          onChange={e => setSloganSize(Number(e.target.value))}
          className="w-[80px] accent-[#7c2fd4]"
        />
        <span className="text-[11px] text-white/35 min-w-[24px]">{sloganSize}px</span>
      </div>

      {bgPreset === 'gradient' && (
        <>
          {/* Divider */}
          <div className="w-[1px] h-6 bg-white/10" />

          {/* Angle slider */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-white/45 whitespace-nowrap">Angle</label>
            <input
              type="range"
              min="0"
              max="360"
              value={angle}
              onChange={e => updateAngle(e.target.value)}
              className="w-[100px] accent-[#7c2fd4]"
            />
            <span className="text-[11px] text-white/35 min-w-[32px]">{angle}°</span>
          </div>
        </>
      )}

      {/* Export button */}
      <button
        onClick={onExport}
        className="ml-auto px-[18px] py-[7px] bg-gradient-to-br from-[#7c2fd4] to-[#3b1fa8] border-none rounded-[7px] text-white text-xs font-semibold cursor-pointer transition-opacity hover:opacity-80"
      >
        &#11015; Export PNG
      </button>
    </header>
  );
}
