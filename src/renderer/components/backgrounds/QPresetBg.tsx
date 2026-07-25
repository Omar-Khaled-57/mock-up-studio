export default function QPresetBg() {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: 'linear-gradient(135deg, #1a3a5c, #2563eb)' }}>
      <div
        className="absolute rounded-full border opacity-15"
        style={{ width: '320px', height: '320px', top: '-60px', right: '-40px', borderColor: '#fff' }}
      />
      <div
        className="absolute rounded-full border opacity-10"
        style={{ width: '500px', height: '500px', bottom: '-120px', left: '-100px', borderColor: '#fff' }}
      />
      <div
        className="absolute rounded-full opacity-10"
        style={{ width: '180px', height: '180px', top: '40%', left: '60%', background: 'rgba(255,255,255,0.05)' }}
      />
    </div>
  )
}
