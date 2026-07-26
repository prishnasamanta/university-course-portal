# University Course Registration & Result Portal

Full-stack portal for course registration, instructor scheduling, marks entry, and multi-stage grade card publication.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + Vite + React Router |
| Backend | Node.js + Express |
| Database | SQLite (via sql.js) |
| Auth | JWT + bcrypt |

## Getting Started

**Stop any running server before seeding** (so the database file is not locked).

### Backend
```bash
cd server
npm install
npm run seed    # demo data
npm run dev     # http://localhost:4000
```

### Frontend
```bash
cd client
npm install
npm run dev     # http://localhost:5173
```

Open **http://localhost:5173**

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Student | alice@student.uni.edu | student123 |
| Student | bob@student.uni.edu | student123 |
| Instructor | dr.smith@uni.edu | inst123 |
| Academic Staff | staff@uni.edu | staff123 |
| Dept Head | head@uni.edu | head123 |
| Admin | admin@uni.edu | admin123 |

## User Flows

### Student
1. **First login** → "Add Your Details" overlay (name, previous degree, grade, email, current semester)
2. **Course Registration** → semester auto-selected to current semester
3. Browse courses (only those with assigned instructors)
4. Click a course → see instructor, Mon–Wed timetable, prerequisites, degree/grade requirements
5. Pick a **preferred day** (non-clashing slots only) and register
6. **Grade Card** → track 5-stage publication status

### Instructor
1. **First login** → select courses to teach + day + 2-hour slot (generates Mon–Wed schedule for students)
2. **Results Entry** → after Academic Staff marks exams complete, enter marks (0–100) per student
3. Marks auto-forward to Academic Staff for verification

### Academic Staff
1. **Course Management** → add CS/Eco/Stat courses (B.Tech, M.Sc, M.Tech) with prerequisites & syllabus
2. Assign instructors / sync sections from instructor preferences
3. **Grade Workflow** → mark exams done → forward to HOD → publish approved grade cards

### Department Head
1. **HOD Review** → see all courses, student marks, grade cards forwarded from staff
2. Accept/reject **individually** or **approve everyone** with one checkbox

## Grade Card Status Pipeline

| # | Status | Meaning |
|---|--------|---------|
| 1 | Papers submitted | Exams done, marks not entered |
| 2 | Checked but to be verified | Instructor entered marks → with Academic Staff |
| 3 | Waiting for HOD approval | Forwarded to Department Head |
| 4 | Grade card ready yet to be publish | HOD approved → awaiting staff publish |
| 5 | Published | Grades visible to student |

## Course Catalog (Demo)

| Code | Level | Prerequisites | Min Grade |
|------|-------|---------------|-----------|
| CS101 | B.Tech | None | — |
| CS201 | B.Tech | CS101 | — |
| CS301 | B.Tech | CS201 | B.Tech + grade B |
| MA101 | B.Tech | None | — |
| ECO201 | B.Tech | None | — |
| CS501 | M.Sc | CS301 | B.Tech + grade B+ |
| CS601 | M.Tech | CS501 | M.Sc + grade A |
| ST301 | M.Sc | CS101 | B.Sc + grade B |

## Business Rules

- Prerequisites must be cleared (completed with grade point ≥ 1.0)
- Degree level & minimum previous grade enforced per course
- Timetable clash detection per chosen day/slot
- Section capacity limits
- Courses visible to students only when instructor is assigned
- Marks require exams to be marked complete by Academic Staff
