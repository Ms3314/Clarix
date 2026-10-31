# Settings Panel - UI Layout

## Settings Page Structure

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  Settings                                                    │
│  Manage your profile and account preferences                │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Profile Picture                            ✓ Active        │
│                                                              │
│  ┌─────────────────┐    ┌─────────────────────────┐        │
│  │      📷         │    │ Choose Image            │        │
│  │     Preview     │    │ ┌─────────────────────┐ │        │
│  │   (132×132px)   │    │ │ Select File Button │ │        │
│  │                 │    │ └─────────────────────┘ │        │
│  │   (or initials) │    │ Max 5MB, JPG/PNG/WebP   │        │
│  └─────────────────┘    │                         │        │
│                         │ ┌─────┬──────┐         │        │
│                         │ │Save │Cancel│         │        │
│                         │ └─────┴──────┘         │        │
│                         └─────────────────────────┘        │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Account Information                                        │
│                                                              │
│  USERNAME                                                   │
│  john_doe                                                   │
│                                                              │
│  EMAIL                                                      │
│  john@example.com                                           │
│                                                              │
│  ROLE                                                       │
│  teacher [Teacher Badge]                                   │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Account                                   [Logout Button]  │
│  Logout from your account                                   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Sidebar with Profile Picture

```
┌─────────────────────┐
│ Clarix              │
│ (with logo)         │
├─────────────────────┤
│ Main                │
│ 📊 Dashboard        │
│ 📖 Learn            │
│                     │
│ Classrooms ▼        │
│ 📚 Math 101         │
│ 🔬 Biology 201      │
│ 📖 English 102      │
│                     │
├─────────────────────┤
│  ┌─────┐            │
│  │ 📷  │ john_doe  │
│  │(pic)│ student   │
│  └─────┘  ▼        │
│  • Settings        │
│  • Logout          │
└─────────────────────┘
```

## Classroom Card with Teacher Picture

```
┌──────────────────────────────┐
│  Math Course Banner          │
│  (gradient or image)         │
├──────────────────────────────┤
│  Mathematics 101             │
│                              │
│  ┌────┐                      │
│  │ 📷 │ Sarah Wilson        │
│  └────┘                      │
│                              │
│  25 students      [Copy Link]│
└──────────────────────────────┘
```

## Profile Avatar Component - Sizes

```
Small (sm):   ██ 8px × 8px
Medium (md):  ████ 12px × 12px
Large (lg):   ████████ 16px × 16px
Extra (xl):   ████████████████ 24px × 24px
```

Example: Medium Avatar
```
  ┌───────────────┐
  │  ┌─────────┐  │
  │  │   📷    │  │
  │  │  (pic)  │  │
  │  │ or "JS" │  │
  │  └─────────┘  │
  └───────────────┘
  Green gradient background
  with white text/icon
```

## Student List in Classroom

```
┌─────────────────────────────────────────────┐
│ Students (3)                                │
├─────────────────────────────────────────────┤
│                                             │
│ ┌─────┐ John Smith                         │
│ │📷(1)│ john@example.com                   │
│ └─────┘                                    │
│                                             │
│ ┌─────┐ Jane Doe                           │
│ │📷(2)│ jane@example.com                   │
│ └─────┘                                    │
│                                             │
│ ┌─────┐ Bob Johnson                        │
│ │📷(3)│ bob@example.com                    │
│ └─────┘                                    │
│                                             │
└─────────────────────────────────────────────┘
```

## Upload Flow - State Progression

### State 1: Initial (No Picture)
```
Settings
├─ Profile Picture
│  ├─ Preview: Camera Icon + "No picture"
│  └─ Action: [Upload] [Remove] ← Remove disabled
```

### State 2: Uploading
```
Settings
├─ Profile Picture
│  ├─ Preview: Selected Image
│  └─ Action: [Uploading...] [Cancel] ← Save disabled during upload
```

### State 3: Uploaded
```
Settings
├─ Profile Picture ✓ Active
│  ├─ Preview: Profile Picture
│  └─ Action: [Upload] [Remove]
```

### State 4: File Selected (Before Upload)
```
Settings
├─ Profile Picture
│  ├─ Preview: Selected Image
│  └─ Action: [Save] [Cancel] ← Changed buttons
```

## Color Scheme

### Primary Colors
- Background: `#faf8f6` (Off-white)
- Cards: `#ffffff` (White)
- Primary: `#4a7c59` (Green)

### Text Colors
- Primary: `#0d0d0d` (Dark)
- Secondary: `#4a4948` (Gray-dark)
- Tertiary: `#6b6a68` (Gray)
- Light: `#acaaa6` (Gray-light)

### Borders
- Primary: `#e8e4e0` (Light gray)
- Secondary: `#333333` (Dark gray)

### Interactive States
- Hover: `#f0eae3` (Light background)
- Active: `#4a7c59/10` (Green tint)
- Success: `#4a7c59` (Green)
- Danger: `#c41c3b` or `#dc2626` (Red)

## Responsive Behavior

### Desktop (1024px+)
- Settings page max-width: 640px
- Two-column layout for profile picture section
- Full sidebar visible

### Tablet (768px - 1023px)
- Settings page full width with padding
- Profile picture section stacked
- Responsive buttons

### Mobile (< 768px)
- Full screen settings
- Stacked layout
- Touch-friendly buttons
- Hamburger sidebar menu
