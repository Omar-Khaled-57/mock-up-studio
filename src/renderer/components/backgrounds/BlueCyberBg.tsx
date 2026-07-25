export default function BlueCyberBg() {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: 'linear-gradient(160deg, #000428, #004e92)' }}>
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 180, 255, 0.15) 2px, rgba(0, 180, 255, 0.15) 4px)',
          animation: 'cyber-scanlines 8s linear infinite'
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 30% 40%, rgba(0, 120, 255, 0.15) 0%, transparent 50%), radial-gradient(circle at 70% 60%, rgba(0, 200, 255, 0.1) 0%, transparent 50%)',
          animation: 'cyber-pulse 6s ease-in-out infinite alternate'
        }}
      />
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: `${2 + (i % 3)}px`,
            height: `${2 + (i % 3)}px`,
            left: `${(i * 17 + 5) % 100}%`,
            top: `${(i * 23 + 10) % 100}%`,
            background: `rgba(0, ${150 + (i * 10) % 106}, 255, ${0.3 + (i % 4) * 0.1})`,
            animation: `cyber-particle-${i % 3} ${4 + (i % 3)}s ease-in-out infinite alternate`
          }}
        />
      ))}
      <style>{`
        @keyframes cyber-scanlines {
          0% { background-position: 0 0; }
          100% { background-position: 0 100px; }
        }
        @keyframes cyber-pulse {
          0% { opacity: 1; }
          100% { opacity: 0.7; }
        }
        @keyframes cyber-particle-0 {
          0% { transform: translate(0, 0); opacity: 0.3; }
          100% { transform: translate(10px, -15px); opacity: 0.8; }
        }
        @keyframes cyber-particle-1 {
          0% { transform: translate(0, 0); opacity: 0.5; }
          100% { transform: translate(-8px, 12px); opacity: 0.2; }
        }
        @keyframes cyber-particle-2 {
          0% { transform: translate(0, 0); opacity: 0.4; }
          100% { transform: translate(15px, 8px); opacity: 0.7; }
        }
      `}</style>
    </div>
  )
}
