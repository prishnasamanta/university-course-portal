# CHANGELOG — University Course Portal

All notable changes to the backend are documented here.

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
