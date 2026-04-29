import { Button } from '@/components/ui/button'

export const StudentsTab = ({ user, students, inviteEmail, setInviteEmail, inviteLoading, onInvite, classroom }) => {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold" style={{ color: '#f0f0f0' }}>Students</h2>
        <span className="text-sm" style={{ color: '#666666' }}>{students.length} enrolled</span>
      </div>

      {user?.role === 'teacher' && (
        <div className="mb-6 p-4 rounded-lg" style={{ background: '#1a1a1a', border: '1px solid #333333' }}>
          <h3 className="text-sm font-medium mb-3" style={{ color: '#888888' }}>Invite a Student</h3>
          <div className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onInvite()}
              placeholder="Enter student email"
              className="flex-1 px-3 py-2 rounded-md text-sm"
              style={{ 
                background: '#0d0d0d', 
                border: '1px solid #444444', 
                color: '#f0f0f0'
              }}
            />
            <Button
              onClick={onInvite}
              disabled={inviteLoading || !inviteEmail}
              style={{ background: '#ffffff', color: '#000000' }}
            >
              {inviteLoading ? 'Sending...' : 'Send Invite'}
            </Button>
          </div>
          <p className="text-xs mt-2" style={{ color: '#666666' }}>
            Or share the invite code: <strong style={{ color: '#f0f0f0' }}>{classroom.invite_code}</strong>
          </p>
        </div>
      )}

      {students.length === 0 ? (
        <div className="text-center py-12">
          <p style={{ color: '#666666' }}>No students enrolled yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {students.map((student) => (
            <div
              key={student.id}
              className="flex items-center justify-between px-4 py-3 rounded-lg"
              style={{ background: '#1a1a1a', border: '1px solid #333333' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium" style={{ background: '#333333', color: '#ffffff' }}>
                  {student.username?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: '#f0f0f0' }}>{student.username}</p>
                  <p className="text-xs" style={{ color: '#666666' }}>{student.email}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}