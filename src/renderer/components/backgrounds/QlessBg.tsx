export default function QlessBg() {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: 'linear-gradient(135deg, #2d1b69, #7c3aed)' }}>
      <div
        className="absolute rounded-full opacity-10"
        style={{ width: '400px', height: '400px', top: '-80px', left: '-80px', background: 'radial-gradient(circle, #a78bfa, transparent 70%)' }}
      />
      <div
        className="absolute rounded-full opacity-10"
        style={{ width: '350px', height: '350px', bottom: '-60px', right: '-60px', background: 'radial-gradient(circle, #c4b5fd, transparent 70%)' }}
      />
      <div
        className="absolute rounded-full opacity-5"
        style={{ width: '200px', height: '200px', top: '35%', left: '45%', background: 'radial-gradient(circle, #fff, transparent 70%)' }}
      />
    </div>
  )
}
