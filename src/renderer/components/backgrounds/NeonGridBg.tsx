export default function NeonGridBg() {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: '#0a0a0a' }}>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 255, 200, 0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 200, 0.06) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          transform: 'perspective(600px) rotateX(55deg) translateY(-20%)',
          transformOrigin: 'center bottom',
          animation: 'neon-scroll 4s linear infinite'
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, transparent 0%, rgba(0, 255, 200, 0.03) 50%, transparent 100%)'
        }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 h-1/3"
        style={{
          background: 'linear-gradient(180deg, transparent, rgba(0, 255, 200, 0.08))'
        }}
      />
    </div>
  )
}
