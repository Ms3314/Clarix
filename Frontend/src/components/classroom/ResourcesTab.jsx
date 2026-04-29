import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export const ResourcesTab = ({ 
  user, 
  resources, 
  uploading,
  editingResourceId,
  editingFilename,
  onUploadClick,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onFileChange,
  onFilenameChange
}) => {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold" style={{ color: '#f0f0f0' }}>Resources</h2>
        {user?.role === 'teacher' && (
          <div className="flex gap-2">
            <input
              type="file"
              id="resource-upload"
              accept=".pdf"
              className="hidden"
              disabled={uploading}
              onChange={onFileChange}
            />
            <Button
              onClick={() => document.getElementById('resource-upload').click()}
              disabled={uploading}
              style={{ background: '#ffffff', color: '#000000' }}
            >
              {uploading ? 'Uploading...' : 'Upload Resource'}
            </Button>
          </div>
        )}
      </div>
      
      {resources.length === 0 ? (
        <p style={{ color: '#666666' }}>No resources uploaded yet.</p>
      ) : (
        <div className="space-y-4">
          {resources.map((resource) => (
            <Card key={resource.id} style={{ background: '#1a1a1a', border: '1px solid #333333' }}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    {editingResourceId === resource.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingFilename}
                          onChange={(e) => onFilenameChange(e.target.value)}
                          className="px-2 py-1 rounded text-sm"
                          style={{ 
                            background: '#0d0d0d', 
                            border: '1px solid #444444', 
                            color: '#f0f0f0'
                          }}
                          autoFocus
                        />
                        <Button size="sm" onClick={() => onSaveEdit(resource.id)} style={{ background: '#ffffff', color: '#000000' }}>
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={onCancelEdit} style={{ borderColor: '#444444', color: '#f0f0f0' }}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <a
                          href={resource.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium cursor-pointer"
                          style={{ color: '#ffffff' }}
                        >
                          {resource.filename}
                        </a>
                        <p className="text-sm" style={{ color: '#666666' }}>
                          {resource.indexed ? 'Indexed' : 'Processing...'}
                        </p>
                      </div>
                    )}
                  </div>
                  {user?.role === 'teacher' && editingResourceId !== resource.id && (
                    <div className="flex items-center gap-2 ml-4">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => onStartEdit(resource)}
                        style={{ borderColor: '#444444', color: '#f0f0f0' }}
                      >
                        Edit
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={() => onDelete(resource.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}