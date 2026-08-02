export default function AuroraBg() {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: '#0b1628' }}>
      <div
        className="bg-animation-exempt absolute rounded-full blur-3xl opacity-50"
        style={{
          width: '60%',
          height: '60%',
          top: '-10%',
          left: '-10%',
          background: 'radial-gradient(circle, #1e3a5f 0%, transparent 70%)',
          animation: 'aurora-drift-1 12s ease-in-out infinite alternate'
        }}
      />
      <div
        className="bg-animation-exempt absolute rounded-full blur-3xl opacity-40"
        style={{
          width: '50%',
          height: '50%',
          bottom: '-5%',
          right: '-5%',
          background: 'radial-gradient(circle, #4a1942 0%, transparent 70%)',
          animation: 'aurora-drift-2 15s ease-in-out infinite alternate'
        }}
      />
      <div
        className="bg-animation-exempt absolute rounded-full blur-3xl opacity-30"
        style={{
          width: '40%',
          height: '40%',
          top: '30%',
          left: '30%',
          background: 'radial-gradient(circle, #0f3460 0%, transparent 70%)',
          animation: 'aurora-drift-3 18s ease-in-out infinite alternate'
        }}
      />
    </div>
  )
}
