const TABS = ['overview', 'students', 'resources', 'chat', 'quizzes', 'flashcards']

export const ClassroomTabs = ({ activeTab, onTabChange, onChatTabClick }) => {
  const handleTabClick = (tab) => {
    onTabChange(tab)
    if (tab === 'chat' && onChatTabClick) {
      onChatTabClick()
    }
  }

  return (
    <div className="border-b" style={{ borderColor: '#333333' }}>
      <nav className="flex -mb-px">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabClick(tab)}
            className={`py-4 px-6 font-medium text-sm ${activeTab === tab ? 'border-b-2' : ''}`}
            style={activeTab === tab 
              ? { borderColor: '#ffffff', color: '#ffffff' }
              : { color: '#666666' }
            }
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>
    </div>
  )
}