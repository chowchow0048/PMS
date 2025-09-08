# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Frontend (Next.js)
```bash
cd frontend
npm install                 # Install dependencies
npm run dev                # Start development server with Turbo
npm run dev:normal         # Start development server (normal mode)
npm run build              # Build for production
npm run lint               # Run ESLint
npm run lint:fix           # Fix linting issues automatically
npm run type-check         # Run TypeScript type checking
```

### Backend (Django)
```bash
cd backend
pip install -r requirements.txt    # Install dependencies
python manage.py migrate           # Run database migrations
python manage.py runserver         # Start development server
python manage.py shell            # Django shell
python manage.py collectstatic     # Collect static files
```

### Testing
```bash
# Load test for clinic reservation system
python run_clinic_test.py

# Setup test clinics
python backend/manage.py setup_test_clinics --reset

# Clinic reservation stress test
python backend/scripts/clinic_reservation_stress_test.py
```

## Architecture Overview

This is a student placement and clinic management system with a Django backend and Next.js frontend.

### Core Data Models (backend/core/models.py)
- **User**: Unified model for students and teachers with role-based fields
- **Subject**: Academic subjects (physics1, etc.)
- **Clinic**: Weekly clinic sessions with capacity management
- **WeeklyReservationPeriod**: Manages weekly clinic reservation cycles
- **ClinicAttendance**: Tracks attendance and no-shows
- **StudentPlacement**: Student-teacher assignments

### Key Features
1. **Role-based Authentication**: Admin, Teacher, Student roles with different access levels
2. **Student Placement System**: Two-phase placement process
   - Phase 1: Assign students to teachers
   - Phase 2: Create specific clinic sessions with time slots
3. **Clinic Reservation**: Students can reserve spots in weekly clinics
4. **Automated Weekly Reset**: Clinics reset every Monday at midnight
5. **Attendance Tracking**: With SMS notifications to parents
6. **No-show Management**: Blocks students after multiple no-shows

### Frontend Structure
- **Authentication**: Role-based guards and HOCs (AuthGuard, MyPageGuard)
- **Student Placement**: Drag-and-drop interface for assigning students
- **Theme System**: Dark/light mode with next-themes
- **State Management**: React Context + SWR for data fetching

### API Authentication
Uses Django Token Authentication. Include token in headers:
```javascript
headers: { 'Authorization': `Token ${token}` }
```

### Key Directories
- `backend/core/`: Core models, admin, signals
- `backend/api/`: API endpoints and serializers
- `frontend/src/app/`: Next.js app router pages
- `frontend/src/components/`: Reusable React components
- `frontend/src/lib/`: Authentication, API client, types

### Database
- Production: PostgreSQL
- Development: SQLite (default)
- Migrations located in `backend/core/migrations/`

### Automated Systems
- **Weekly Reset**: `setup_weekly_reset_cron.sh` configures automatic clinic reset
- **Scheduler**: Django-APScheduler for background tasks
- **Logging**: Comprehensive logging in `backend/logs/`

### Role-based Access
- **Admin/Superuser**: Access to student-placement page and all mypages
- **Teacher**: Access only to their own mypage
- **Student**: Basic access to clinic reservation features

## Development Notes

### TypeScript Types
Frontend types are centralized in `frontend/src/lib/types.ts` and mirror Django models.

### State Management
- Use SWR for server state
- React Context for auth state
- Local state with useState/useReducer

### Styling
- Chakra UI component library
- CSS modules for custom styling
- Responsive design with mobile-first approach

### Error Handling
- API interceptors handle 401 redirects
- Toast notifications for user feedback
- Comprehensive error logging

### Performance Features
- Next.js Turbo mode for fast development
- Bundle analyzer available (`npm run build:analyze`)
- Background tasks with Django-APScheduler

## Important Files
- `backend/core/models.py`: All data models
- `frontend/src/lib/authGuard.tsx`: Authentication guards
- `frontend/src/lib/types.ts`: TypeScript type definitions
- `backend/core/scheduler.py`: Background task scheduling
- `run_clinic_test.py`: Load testing utility