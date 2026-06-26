# Group Chat Features Documentation

## Overview
This document describes the group chat functionality implemented for Clarix.

## Features Implemented

### 1. Automatic Group Chat Membership
- **Student Joins Class**: When a student's enrollment is approved, they automatically gain access to the class group chat
- **Student Leaves Class**: When a student is removed from a class, they are immediately disconnected from the chat (WebSocket kicked)
- **Teacher Assignment**: Main teachers and co-teachers automatically have admin access to the class group chat

### 2. Chat Permissions
- **Teachers/Co-Teachers**:
  - Can delete any message
  - Can pin/unpin messages
  - Can add/remove members (students or co-teachers)
  - Can clear chat history
- **Students**:
  - Can send messages
  - Can view chat history
  - Can delete their own messages

### 3. Verification & Sync
- **Verification Endpoint**: `/chat/verify` - Checks that all class members have proper chat access
- **Manual Sync Endpoint**: `/chat/sync` - Kicks any connected users who are no longer class members

### 4. Data Models
- **GroupChatMessage**: Stores chat messages with sender info, timestamps, and soft delete status
- **PinnedGroupChatMessage**: Tracks pinned messages in each class chat

## Backend Endpoints
- `GET /chat/rooms` - Get list of chat rooms the current user has access to
- `GET /chat/rooms/{classroom_id}/history` - Get chat history for a specific room
- `DELETE /chat/rooms/{classroom_id}/history` - Clear all chat history (admin only)
- `DELETE /chat/rooms/{classroom_id}/messages/{message_id}` - Delete a specific message
- `POST /chat/rooms/{classroom_id}/messages/{message_id}/pin` - Pin a message
- `DELETE /chat/rooms/{classroom_id}/messages/{message_id}/pin` - Unpin a message
- `POST /chat/rooms/{classroom_id}/members` - Add a member to the class
- `DELETE /chat/rooms/{classroom_id}/members/{user_id}` - Remove a member from the class
- `GET /chat/verify` - Verify chat memberships
- `POST /chat/sync` - Sync connected users with class memberships

## WebSocket
- Connect to: `ws://{host}/chat/ws/{classroom_id}/{token}`
- Messages are broadcast to all connected members of the class
