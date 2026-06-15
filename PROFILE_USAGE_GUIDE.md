# Profile Picture Feature - Usage Guide

## For End Users

### Uploading a Profile Picture

1. **Navigate to Settings**
   - Click on your profile dropdown in the sidebar footer
   - Select "Settings"
   - Or navigate directly to `/settings`

2. **Upload Your Picture**
   - In the "Profile Picture" section, click the "Upload" button
   - Select an image file (JPG, PNG, or WebP)
   - Maximum file size: 5MB
   - A preview will appear instantly

3. **Confirm Upload**
   - Review the preview
   - Click "Save" to upload
   - Click "Cancel" if you want to choose a different image

4. **Delete Picture**
   - If you have a profile picture, click the "Remove" button
   - Confirm deletion
   - Your profile will revert to showing your initials

### Viewing Profile Pictures

- **In Sidebar**: Your profile picture appears in the footer when you're logged in
- **On Dashboard**: See teacher profile pictures on classroom cards
- **In Classrooms**: View other students' profile pictures in the students list
- **In Classroom Info**: See teacher and co-teacher profile pictures

## For Developers

### API Endpoints

#### Upload Profile Picture
```http
POST /profile/picture/upload
Content-Type: multipart/form-data

file: <image_file>

Response:
{
  "message": "Profile picture uploaded successfully",
  "profile_picture_url": "https://..."
}
```

#### Delete Profile Picture
```http
DELETE /profile/picture

Response:
{
  "message": "Profile picture deleted successfully"
}
```

#### Get User Profile
```http
GET /profile/me/details

Response:
{
  "id": 1,
  "username": "john_doe",
  "email": "john@example.com",
  "role": "student",
  "profile_picture_url": "https://..." | null,
  "profile_picture_updated_at": "2025-06-15T10:30:00" | null
}
```

#### Get Specific User Profile Picture
```http
GET /profile/{user_id}/picture

Response:
{
  "id": 1,
  "username": "jane_smith",
  "profile_picture_url": "https://..." | null
}
```

### Using the ProfilePictureAvatar Component

```jsx
import ProfilePictureAvatar from '@/components/ProfilePictureAvatar'

// Basic usage
<ProfilePictureAvatar 
  profilePictureUrl={user.profile_picture_url}
  username={user.username}
  size="md"
/>

// Available sizes: "sm" (8px), "md" (12px), "lg" (16px), "xl" (24px)
<ProfilePictureAvatar 
  profilePictureUrl={user.profile_picture_url}
  username={user.username}
  size="lg"
/>
```

### Using the StudentProfileCard Component

```jsx
import StudentProfileCard from '@/components/StudentProfileCard'

<StudentProfileCard student={studentData} />
```

### Database Schema

#### Users Table Addition
```sql
ALTER TABLE users ADD COLUMN profile_picture_url VARCHAR;
ALTER TABLE users ADD COLUMN profile_picture_updated_at DATETIME;
```

The new fields in the Users model:
```python
profile_picture_url = Column(String, nullable=True)
profile_picture_updated_at = Column(DateTime, nullable=True)
```

### Classroom Endpoints Updated

All the following endpoints now include profile picture information:

1. **GET /classrooms/** 
   - Each classroom includes `teacher_profile_picture`

2. **GET /classrooms/info/{invite_code}**
   - Returns `teacher_profile_picture`
   - Co-teachers include `profile_picture_url`

3. **GET /classrooms/{classroom_id}/students**
   - Each student includes `profile_picture_url`

## Storage Details

### Supabase Configuration

Profile pictures are stored in the `profile-pictures` bucket on Supabase.

**Bucket Setup** (if not already created):
1. Go to Supabase Dashboard
2. Navigate to Storage
3. Create a bucket named `profile-pictures`
4. Set it to **Public** for file access
5. Add a policy to allow authenticated users to upload

**Example RLS Policy for Upload:**
```sql
CREATE POLICY "Allow authenticated users to upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'profile-pictures');
```

### File Organization

- **Storage Path**: `profile-pictures/{user_id}_{timestamp}.{extension}`
- **Example**: `profile-pictures/123_1718431200000.jpg`

## Testing

### Manual Testing Steps

1. **Create Test Users**
   - One teacher account
   - One student account

2. **Test Upload Flow**
   - Navigate to settings
   - Upload valid image
   - Verify it appears in preview
   - Verify it saves correctly

3. **Test Image Validation**
   - Try uploading non-image file (should fail)
   - Try uploading image > 5MB (should fail)
   - Try uploading various image formats (JPG, PNG, WebP)

4. **Test Display**
   - Check sidebar shows picture
   - Check dashboard classroom cards show teacher picture
   - Check students list shows student pictures

5. **Test Deletion**
   - Upload a picture
   - Delete it
   - Verify initials appear again

6. **Test Fallback**
   - Break image URL in browser console
   - Verify initials are shown as fallback

## Troubleshooting

### "Storage service unavailable"
- Check Supabase credentials in `.env`
- Verify bucket exists and is public
- Check network connectivity

### Image not uploading
- Verify file is an image (JPG, PNG, WebP)
- Check file size is < 5MB
- Check browser console for detailed errors

### Profile picture not showing
- Clear browser cache
- Check if user has profile_picture_url in database
- Verify Supabase URL is accessible
- Check image URL is public

### Avatar showing initials but not image
- Image file may have been deleted from Supabase
- URL may have expired
- Component gracefully falls back to initials (by design)

## Performance Considerations

- Profile pictures are cached by the browser
- Supabase CDN provides fast delivery
- Images are stored with user ID to prevent collisions
- Consider implementing image optimization/compression if needed

## Security

- File type validation (image files only)
- File size limit (5MB)
- User authentication required for upload
- Each user can only upload their own picture
- Public read access for all users to view pictures

## Future Enhancements

1. **Image Cropping**: Let users crop images before upload
2. **Image Compression**: Automatically compress/optimize images
3. **Multiple Pictures**: Allow users to have multiple profile pictures
4. **Picture Gallery**: Display recently uploaded pictures
5. **Profile Customization**: Add bio, cover photo, etc.
