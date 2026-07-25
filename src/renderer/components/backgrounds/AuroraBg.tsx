export default function AuroraBg() {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: '#0b1628' }}>
      <div
        className="absolute rounded-full blur-3xl opacity-50"
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
        className="absolute rounded-full blur-3xl opacity-40"
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
        className="absolute rounded-full blur-3xl opacity-30"
        style={{
          width: '40%',
          height: '40%',
          top: '30%',
          left: '30%',
          background: 'radial-gradient(circle, #0f3460 0%, transparent 70%)',
          animation: 'aurora-drift-3 18s ease-in-out infinite alternate'
        }}
      />
      <style>{`
        @keyframes aurora-drift-1 {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(8%, 5%) scale(1.1); }
        }
        @keyframes aurora-drift-2 {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(-6%, -8%) scale(1.15); }
        }
        @keyframes aurora-drift-3 {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(5%, -5%) scale(1.05); }
        }
      `}</style>
    </div>
  )
}
