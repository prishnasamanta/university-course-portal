# CHANGELOG — University Course Portal

All notable changes to the backend are documented here.

## [2026-07-29] Paper Review Workflow, Course Creation Fix & Student Registration Fixes

### Course Registered Students Listing & Admin Unenrollment
- Added `/api/workflow/courses/:courseId/students` & `/api/workflow/sections/:sectionId/registered-students` endpoints for Teachers, Academic Staff, and Admin to view all enrolled students with timetable slot & grade info.
- Added `/api/workflow/enrollments/:enrollmentId` DELETE endpoint allowing Admin/Staff to unenroll/remove registered students from any course, with real-time PostgreSQL synchronization.

### Course Registration & Timetable Selection Fix
- Enhanced `registerStudent` in `registration.js` to automatically fall back to the first available non-clashing slot if no `chosenSlotId` is explicitly provided, ensuring `enrollments` and `result_workflow` tables are populated immediately upon registration.

### Paper Review Workflow
- Added complete multi-stage paper recheck pipeline:
  1. Student requests paper review (`/api/workflow/paper-review/request`)
  2. Student tracks status (`/api/workflow/paper-review/my-requests`)
  3. Academic Staff reviews pending requests (`/api/workflow/paper-review/staff-requests`)
  4. Academic Staff forwards to assigned Instructor (`/api/workflow/paper-review/:id/forward`)
  5. Instructor re-checks paper & updates marks/remarks (`/api/workflow/paper-review/instructor-requests`, `/recheck`)
  6. Academic Staff finalizes approval/rejection (`/api/workflow/paper-review/:id/finalize`)
  7. Auto-recomputes grades and updates `course_results`, `marks`, `enrollment_grades`, and PostgreSQL live sync.

### Prerequisite Removal
- Completely removed redundant `course_prerequisites` table across SQLite schema, PostgreSQL migrations, and registration validation.

### Fixes & Enhancements
- Fixed `POST /courses` route try/catch handling to prevent 500 Internal Server Errors when adding courses.
- Enforced real-time `enrollments` table updates with `chosen_slot_id` upon student course registration.

---

## [2026-07-29] Database Simplification & Schema Refactor

### Removed Tables
- `instructors` — merged into `users` (department, employee_id now in users)
- `academic_staff` — removed (role stored in users.role)
- `dept_heads` — removed (role stored in users.role)
- `admins` — removed (role stored in users.role)

### Schema Changes
- **users table**: Added `password` (plain text), `department`, `employee_id`, `profile_completed` columns
- **sections.instructor_id**: Now references `users(id)` directly (was `instructors(id)`)
- **instructor_teaching_preferences.instructor_id**: Now references `users(id)` directly

### Route Changes
- `auth.js`: Register stores plain password + hash; instructor profile stored in users table directly
- `instructors.js`: All queries use `users` table; `getInstructorByUserId` returns user row
- `students.js`: All instructor JOINs use `LEFT JOIN users u_instr ON u_instr.id = s.instructor_id`
- `workflow.js`: All instructor JOINs updated to use `users` table

### Seed Data
- All users now seeded with plain `password` column alongside `password_hash`
- Instructor department/employee_id seeded directly in users table
- Sections reference `users.id` directly instead of via `instructors` table

---

## [2026-07-28] Critical Database Sync Fix

### Bug Fix
- **syncToPostgres was DEAD CODE** — function existed but was never called from `createWrapper`
- Wired `syncToPostgres` into `createWrapper.run()` and `createWrapper.exec()` so every SQLite write mirrors to PostgreSQL in real-time

### Improvements
- Improved `convertSqlForPostgres` to handle `INSERT OR REPLACE`, `datetime('now')`, `AUTOINCREMENT`
- Added filtering to skip SELECT/PRAGMA/CREATE queries from sync
- Better error logging for sync failures

---

## [2026-07-28] Email/Name/Password in Role Tables

### Schema
- Added `email`, `name`, `password_hash` columns to students, instructors, academic_staff, dept_heads, admins tables
- Auto-backfill existing data from users table on startup

### Auth
- Register route populates email/name/password_hash in role-specific tables

---

## [2026-07-27] Dual-Write Architecture & PostgreSQL Integration

### Architecture
- **sql.js (SQLite)**: In-memory runtime database
- **PostgreSQL (Render)**: Persistent production database
- **Hydration**: On startup, SQLite syncs FROM PostgreSQL
- **Dual-Write**: On every write, SQLite mirrors TO PostgreSQL

### Database Connection
- SSL disabled for Render internal URLs
- Fixed DATABASE_URL typo issues (spaces in DB name)

---

## [2026-07-26] Initial Backend Setup

### Features
- User authentication (JWT) with bcrypt password hashing
- Role-based access control (student, instructor, academic_staff, dept_head, admin)
- Course catalog with degree-level filtering
- Section management with schedule slots
- Student enrollment with prerequisite/capacity/timetable checks
- Instructor teaching preferences and auto-section creation
- Assessment components and marks entry
- Grade computation (SGPA/CGPA) with grading policy
- Result workflow (submit → review → publish)
- Exam registration system

### Seed Data
- 35 users (25 students across 5 programs, 6 instructors, staff/head/admin)
- 15 courses across CS, Economics, Statistics
- 15 sections with schedule slots
- 8 semesters
