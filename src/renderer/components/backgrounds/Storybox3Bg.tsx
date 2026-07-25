export default function Storybox3Bg() {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: 'linear-gradient(135deg, #1a0533, #4c1d95)' }}>
      <div
        className="absolute opacity-15"
        style={{
          width: '200px',
          height: '200px',
          top: '10%',
          right: '15%',
          background: '#7c3aed',
          transform: 'rotate(45deg)',
          borderRadius: '24px'
        }}
      />
      <div
        className="absolute opacity-10"
        style={{
          width: '140px',
          height: '140px',
          bottom: '15%',
          left: '10%',
          background: '#a78bfa',
          transform: 'rotate(30deg)',
          borderRadius: '20px'
        }}
      />
      <div
        className="absolute opacity-5"
        style={{
          width: '100px',
          height: '100px',
          top: '50%',
          left: '55%',
          background: '#c4b5fd',
          transform: 'rotate(-15deg)',
          borderRadius: '16px'
        }}
      />
    </div>
  )
}
