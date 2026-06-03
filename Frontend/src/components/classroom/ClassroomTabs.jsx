export const ClassroomTabs = ({ activeTab, onTabChange, user }) => {
  const allTabs = ['overview', 'announcements', 'students', 'resources', 'quizzes', 'flashcards']
  const visibleTabs = user?.role === 'teacher' 
    ? allTabs 
    : allTabs.filter(tab => tab !== 'students')

  return (
    <div className="border-b" style={{ borderColor: '#333333' }}>
      <nav className="flex -mb-px">
        {visibleTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
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