export const ComingSoonTab = ({ emoji, title, subtitle }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
      <div style={{ fontSize: '4rem' }}>{emoji}</div>
      <h2 className="text-xl font-semibold mt-4" style={{ color: '#f0f0f0' }}>{title}</h2>
      <p className="text-sm mt-2" style={{ color: '#666666' }}>{subtitle}</p>
    </div>
  )
}

export const QuizzesTab = () => (
  <ComingSoonTab 
    emoji="📝" 
    title="Coming Soon" 
    subtitle="Quiz functionality will be available soon!" 
  />
)

export const FlashcardsTab = () => (
  <ComingSoonTab 
    emoji="🗂️" 
    title="Coming Soon" 
    subtitle="Flashcard functionality will be available soon!" 
  />
)