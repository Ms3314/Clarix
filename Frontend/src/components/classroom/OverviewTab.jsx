import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export const OverviewTab = ({ classroom }) => {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4" style={{ color: '#f0f0f0' }}>Classroom Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card style={{ background: '#1a1a1a', border: '1px solid #333333' }}>
          <CardHeader>
            <CardTitle style={{ color: '#f0f0f0' }}>Resources</CardTitle>
            <CardDescription style={{ color: '#888888' }}>{classroom.resource_count || 0} uploaded</CardDescription>
          </CardHeader>
        </Card>
        <Card style={{ background: '#1a1a1a', border: '1px solid #333333' }}>
          <CardHeader>
            <CardTitle style={{ color: '#f0f0f0' }}>Quizzes</CardTitle>
            <CardDescription style={{ color: '#888888' }}>{classroom.quiz_count || 0} created</CardDescription>
          </CardHeader>
        </Card>
        <Card style={{ background: '#1a1a1a', border: '1px solid #333333' }}>
          <CardHeader>
            <CardTitle style={{ color: '#f0f0f0' }}>Students</CardTitle>
            <CardDescription style={{ color: '#888888' }}>{classroom.student_count || 0} enrolled</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  )
}