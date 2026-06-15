# Profile Picture Feature Implementation

## Overview
A complete profile picture feature has been added for teachers and students in the Clarix application, including a dedicated settings panel for managing profile pictures.

## Backend Changes

### 1. Database Model Updates (`Backend/models.py`)
Added two new fields to the `Users` model:
- `profile_picture_url` (String, nullable): Stores the URL of the user's profile picture
- `profile_picture_updated_at` (DateTime, nullable): Tracks when the profile picture was last updated

### 2. API Responses (`Backend/auth.py`)
- Updated `UserResponse` model to include `profile_picture_url`
- Updated the `/auth/me` endpoint to return the user's profile picture URL

### 3. Profile Service (`Backend/profile.py`)
Created a new router with the following endpoints:

#### POST `/profile/picture/upload`
- Uploads a new profile picture for the authenticated user
- **Validation**: 
  - Accepts only image files
  - Maximum file size: 5MB
- **Storage**: Uses Supabase storage
- **Response**: Returns the public URL of the uploaded picture

#### DELETE `/profile/picture`
- Removes the user's profile picture
- Sets both `profile_picture_url` and `profile_picture_updated_at` to NULL

#### GET `/profile/{user_id}/picture`
- Retrieves profile picture URL for a specific user
- Public endpoint (no authentication required)
- Useful for displaying other users' pictures

#### GET `/profile/me/details`
- Returns current user's full profile details including picture URL and upload timestamp

### 4. Classroom Endpoints Updates (`Backend/classroom.py`)
Updated the following endpoints to include teacher/co-teacher profile pictures:

- `GET /classrooms/` - Now includes `teacher_profile_picture` in each classroom
- `GET /classrooms/info/{invite_code}` - Includes teacher and co-teacher profile pictures
- `GET /classrooms/{classroom_id}/students` - Each student now includes `profile_picture_url`

## Frontend Changes

### 1. Settings Page (`Frontend/src/pages/Settings.jsx`)
A new settings panel with:
- **Profile Picture Section**:
  - Image preview (132x132px rounded square)
  - File upload input (drag & drop supported)
  - File size and type validation
  - Upload/Save button
  - Delete button (when picture exists)
  - Cancel button (when editing)
  
- **Account Information Section**:
  - Display username, email, and role
  - Read-only fields

- **Logout Section**:
  - Quick logout button

### 2. Profile Picture Avatar Component (`Frontend/src/components/ProfilePictureAvatar.jsx`)
Reusable avatar component with:
- Multiple size options: `sm`, `md`, `lg`, `xl`
- Fallback display with user initials or default icon
- Graceful error handling (shows initials if image fails to load)
- Gradient background with green theme
- Border styling for consistency

### 3. Student Profile Card Component (`Frontend/src/components/StudentProfileCard.jsx`)
Displays student information with:
- Profile picture
- Username
- Email
- Hover effect for better UX

### 4. Sidebar Updates (`Frontend/src/components/AppSidebar.jsx`)
- Added Settings import
- Updated footer to use `ProfilePictureAvatar` component
- Added Settings option in dropdown menu (with gear icon)
- Profile picture now displays in the sidebar footer

### 5. Dashboard Updates (`Frontend/src/pages/Dashboard.jsx`)
- Imported `ProfilePictureAvatar` component
- Updated classroom cards to display teacher's profile picture alongside name
- Better visual identification of classroom owners

### 6. Routing (`Frontend/src/App.jsx`)
- Added `/settings` route
- Settings page is protected and wrapped with AppLayout (sidebar visible)

## File Structure

### Backend Files Created:
```
Backend/profile.py              # New profile endpoints
```

### Backend Files Modified:
```
Backend/models.py               # Added profile picture fields to Users
Backend/auth.py                 # Added profile_picture_url to UserResponse
Backend/main.py                 # Registered profile router
Backend/classroom.py            # Updated endpoints to include profile pictures
```

### Frontend Files Created:
```
Frontend/src/pages/Settings.jsx
Frontend/src/components/ProfilePictureAvatar.jsx
Frontend/src/components/StudentProfileCard.jsx
```

### Frontend Files Modified:
```
Frontend/src/App.jsx             # Added /settings route
Frontend/src/pages/Dashboard.jsx # Display teacher profile pictures
Frontend/src/components/AppSidebar.jsx  # Show profile picture in sidebar
```

## Features

### For Users:
1. **Upload Profile Picture**: Upload any image (JPG, PNG, WebP) up to 5MB
2. **View Profile**: See your profile information in Settings
3. **Delete Picture**: Remove your profile picture anytime
4. **Preview**: See a real-time preview before confirming upload

### For Display:
1. **Profile Pictures in Sidebar**: See your picture in the sidebar footer
2. **Classroom Cards**: See teacher's profile picture on dashboard
3. **Student Lists**: See classmate profile pictures in classroom students list
4. **Avatar Component**: Reusable component throughout the app

## Styling
- Consistent with existing design system (colors: `#4a7c59` primary green, `#faf8f6` background)
- Responsive design for mobile and desktop
- Smooth transitions and hover effects
- Accessible color contrasts

## Storage
- Profile pictures stored in Supabase Storage (`profile-pictures` bucket)
- URL format: `https://[project].supabase.co/storage/v1/object/public/profile-pictures/[user_id]_[timestamp].[ext]`
- Automatic file naming with user ID and timestamp to avoid conflicts

## Error Handling
- File type validation (image files only)
- File size validation (max 5MB)
- Graceful fallbacks (initials display if image fails to load)
- User-friendly error messages via toast notifications
- Network error handling with retry capability

## Future Enhancements
- Image cropping before upload
- Multiple profile pictures gallery
- Profile picture filters
- Profile picture sharing
- Export profile as PDF with picture
