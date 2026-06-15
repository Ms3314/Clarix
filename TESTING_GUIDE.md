# Profile Picture Feature - Implementation Checklist & Testing Guide

## Implementation Checklist

### ✅ Backend Implementation

- [x] Database Model Update (`Backend/models.py`)
  - [x] Added `profile_picture_url` field
  - [x] Added `profile_picture_updated_at` field

- [x] Authentication Updates (`Backend/auth.py`)
  - [x] Updated `UserResponse` model
  - [x] Updated `/auth/me` endpoint

- [x] Profile Router (`Backend/profile.py`)
  - [x] Created new profile service file
  - [x] `POST /profile/picture/upload` endpoint
  - [x] `DELETE /profile/picture` endpoint
  - [x] `GET /profile/{user_id}/picture` endpoint
  - [x] `GET /profile/me/details` endpoint
  - [x] Supabase integration
  - [x] File validation (type & size)

- [x] Main Application (`Backend/main.py`)
  - [x] Imported profile router
  - [x] Registered profile router

- [x] Classroom Updates (`Backend/classroom.py`)
  - [x] Updated `list_classrooms` endpoint
  - [x] Updated `get_classroom_by_invite` endpoint
  - [x] Updated `list_students` endpoint

### ✅ Frontend Implementation

- [x] Settings Page (`Frontend/src/pages/Settings.jsx`)
  - [x] Profile picture upload form
  - [x] Image preview
  - [x] Save/Cancel buttons
  - [x] Delete button
  - [x] Account information display
  - [x] Logout button
  - [x] Error handling with toast notifications
  - [x] Loading states

- [x] Components Created
  - [x] `ProfilePictureAvatar.jsx` - Reusable avatar component
  - [x] `StudentProfileCard.jsx` - Student profile card display

- [x] Integration Updates
  - [x] `App.jsx` - Added `/settings` route
  - [x] `AppSidebar.jsx` - Display profile picture in sidebar
  - [x] `Dashboard.jsx` - Show teacher pictures on classroom cards

- [x] Styling
  - [x] Consistent with design system
  - [x] Responsive layout
  - [x] Accessibility considerations

## Database Migration Steps

### For SQLite (Development):
```bash
# Connect to database
sqlite3 Backend/todosapp.db

# Run migration
ALTER TABLE users ADD COLUMN profile_picture_url VARCHAR NULL;
ALTER TABLE users ADD COLUMN profile_picture_updated_at DATETIME NULL;
```

### For PostgreSQL (Supabase - Production):
```sql
ALTER TABLE users 
ADD COLUMN profile_picture_url TEXT NULL,
ADD COLUMN profile_picture_updated_at TIMESTAMP NULL;

CREATE INDEX idx_users_profile_picture_updated_at 
ON users(profile_picture_updated_at DESC);
```

## Testing Guide

### 1. Backend API Testing

#### Test with cURL:

**Upload Profile Picture:**
```bash
curl -X POST http://localhost:8000/profile/picture/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/image.jpg"
```

**Get Profile Details:**
```bash
curl -X GET http://localhost:8000/profile/me/details \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Get User Profile Picture:**
```bash
curl -X GET http://localhost:8000/profile/1/picture
```

**Delete Profile Picture:**
```bash
curl -X DELETE http://localhost:8000/profile/picture \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Test with Python:

```python
import requests

BASE_URL = "http://localhost:8000"
TOKEN = "your_token_here"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}

# Upload
with open("profile.jpg", "rb") as f:
    files = {"file": f}
    response = requests.post(
        f"{BASE_URL}/profile/picture/upload",
        files=files,
        headers=HEADERS
    )
    print(response.json())

# Get profile
response = requests.get(
    f"{BASE_URL}/profile/me/details",
    headers=HEADERS
)
print(response.json())

# Delete
response = requests.delete(
    f"{BASE_URL}/profile/picture",
    headers=HEADERS
)
print(response.json())
```

### 2. Frontend Testing

#### Manual Testing Steps:

1. **Test Settings Page Navigation**
   - [ ] Click profile dropdown in sidebar
   - [ ] Select "Settings"
   - [ ] Verify page loads with correct user info

2. **Test Upload Flow**
   - [ ] Click "Upload" button
   - [ ] Select a valid image (JPG/PNG/WebP)
   - [ ] Verify preview appears
   - [ ] Click "Save"
   - [ ] Verify success message
   - [ ] Verify picture appears in sidebar

3. **Test File Validation**
   - [ ] Try uploading non-image file → Should show error
   - [ ] Try uploading file > 5MB → Should show error
   - [ ] Try uploading valid images → Should succeed

4. **Test Delete Flow**
   - [ ] Upload a picture
   - [ ] Click "Remove" button
   - [ ] Verify confirmation
   - [ ] Verify picture deleted and initials shown

5. **Test Dashboard Display**
   - [ ] Navigate to Dashboard
   - [ ] Verify teacher profile pictures on classroom cards
   - [ ] Hover over classroom cards → Should show smooth transitions

6. **Test Classroom Students List**
   - [ ] Open a classroom
   - [ ] Go to "Students" tab
   - [ ] Verify all students have profile pictures or initials
   - [ ] Click on a student (if profile feature added)

7. **Test Avatar Fallback**
   - [ ] Check browser DevTools → Network
   - [ ] Block image loading (disable in DevTools)
   - [ ] Reload page
   - [ ] Verify initials show instead of broken image

#### Browser DevTools Testing:

```javascript
// In browser console, test the avatar component
// Clear profile picture from session
localStorage.removeItem('clarix_token');

// Check user data structure
console.log('User:', user);
console.log('Profile Picture URL:', user?.profile_picture_url);
```

### 3. Performance Testing

#### Image Loading Performance:
```bash
# Test image load time
time curl -o /dev/null -s -w "%{time_total}\n" \
  https://your-supabase-url/storage/v1/object/public/profile-pictures/1_1718431200000.jpg
```

#### Database Query Performance:
```sql
-- Test classroom list query performance
EXPLAIN ANALYZE
SELECT c.id, c.name, u.username, u.profile_picture_url
FROM classrooms c
JOIN users u ON c.teacher_id = u.id
LIMIT 10;
```

### 4. Integration Testing

#### Classroom Creation Flow:
1. [ ] Create classroom as teacher
2. [ ] Verify teacher picture appears on classroom card
3. [ ] Invite student
4. [ ] Student joins classroom
5. [ ] Verify student picture appears in students list
6. [ ] Upload teacher's profile picture
7. [ ] Refresh page
8. [ ] Verify updated picture displays

#### Multi-User Scenario:
1. [ ] Create 3 test accounts (2 teachers, 1 student)
2. [ ] Each uploads different profile pictures
3. [ ] Create classroom with both teachers
4. [ ] Student enrolls
5. [ ] Verify all pictures display correctly
6. [ ] One teacher updates picture
7. [ ] Verify update reflected everywhere

### 5. Edge Cases Testing

- [ ] User with no profile picture → Shows initials
- [ ] User with special characters in name → Shows correct initials
- [ ] User deletes picture → Reverts to initials
- [ ] Upload same filename twice → No collision (timestamp prevents it)
- [ ] User logs out and logs back in → Picture persists
- [ ] Classroom with deleted teacher → Graceful handling
- [ ] Very long username → Avatar still readable
- [ ] Mobile responsive → Avatar scales properly

## Verification Checklist

### Backend Verification

```python
# Run in Python shell
from Backend.Database import SessionLocal
from Backend.models import Users

db = SessionLocal()
user = db.query(Users).first()

# Check new fields exist
print(f"Profile Picture URL: {user.profile_picture_url}")
print(f"Updated At: {user.profile_picture_updated_at}")

db.close()
```

### Database Schema Verification

```sql
-- Verify columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('profile_picture_url', 'profile_picture_updated_at');
```

### API Endpoint Verification

```bash
# Get OpenAPI docs
curl http://localhost:8000/docs

# Should show these endpoints:
# POST /profile/picture/upload
# DELETE /profile/picture
# GET /profile/{user_id}/picture
# GET /profile/me/details
```

## Deployment Checklist

### Before Deployment:

- [ ] Database migration run on production
- [ ] Supabase bucket created and configured
- [ ] RLS policies set correctly
- [ ] Environment variables configured (.env)
- [ ] All tests passing
- [ ] Build frontend without errors
- [ ] Backend requirements.txt updated (if needed)

### Supabase Bucket Configuration:

1. Go to Supabase Dashboard → Storage
2. Create bucket: `profile-pictures`
3. Make bucket **Public**
4. Add RLS Policy:
   ```sql
   CREATE POLICY "Allow authenticated users to upload"
   ON storage.objects
   FOR INSERT
   TO authenticated
   WITH CHECK (bucket_id = 'profile-pictures');
   ```

### Environment Variables:

Ensure `.env` has:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
```

## Troubleshooting Common Issues

### "Storage service unavailable"
- [ ] Check SUPABASE_URL and SUPABASE_SERVICE_KEY in .env
- [ ] Verify bucket exists and is public
- [ ] Check network connectivity
- [ ] Restart backend server

### Image not uploading
- [ ] Verify file is image (JPG, PNG, WebP)
- [ ] Check file size < 5MB
- [ ] Check browser console for errors
- [ ] Verify user is authenticated

### Picture not showing after upload
- [ ] Check Supabase URL is accessible
- [ ] Verify image file wasn't deleted from storage
- [ ] Clear browser cache
- [ ] Check database has correct URL stored

### Profile picture shows for some users but not others
- [ ] Check if those users have profile_picture_url in database
- [ ] Verify they uploaded before schema migration
- [ ] Re-run migration if needed

### Sidebar not updating after upload
- [ ] Component may be cached
- [ ] Try hard refresh (Cmd+Shift+R on Mac)
- [ ] Check browser console for errors
- [ ] Verify API returned correct URL

## Success Criteria

- ✅ All endpoints respond correctly
- ✅ Images upload to Supabase successfully
- ✅ Profile pictures display in all UI locations
- ✅ Fallback initials show when no picture
- ✅ Settings panel saves profile picture correctly
- ✅ File validation prevents invalid uploads
- ✅ Delete functionality removes picture
- ✅ Responsive design works on mobile
- ✅ No console errors in browser
- ✅ Database queries perform efficiently

## Performance Benchmarks

Target metrics:
- Upload time: < 2 seconds
- Image load time: < 500ms
- Avatar render time: < 100ms
- Dashboard load with pictures: < 3 seconds
- Settings page load: < 2 seconds

## Support & Resources

- [Supabase Documentation](https://supabase.com/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
