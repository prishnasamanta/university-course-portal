const API_BASE = import.meta.env.VITE_API_URL || '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || data.reason || 'Request failed');
  }
  return data;
}

export const api = {
  // Auth
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (name, email, password, role) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password, role }) }),
  me: () => request('/auth/me'),

  // Student profile
  saveStudentProfile: (data) =>
    request('/profile/student', { method: 'POST', body: JSON.stringify(data) }),
  saveInstructorProfile: (preferences) =>
    request('/instructor/profile', { method: 'POST', body: JSON.stringify({ preferences }) }),
  getInstructorAvailableCourses: () => request('/instructor/available-courses'),

  // General data
  getPrograms: () => request('/programs'),
  getCourses: () => request('/courses'),
  getInstructors: () => request('/instructors'),
  getSemesters: () => request('/semesters'),
  getOfferings: (semesterId) => request(`/offerings/${semesterId}`),
  getCourseDetail: (courseId, semesterId) => request(`/courses/${courseId}/semester/${semesterId}`),

  // Student enrollment
  getMyEnrollments: () => request('/my-enrollments'),
  validateRegistration: (section_id, chosen_slot_id) =>
    request('/register/validate', { method: 'POST', body: JSON.stringify({ section_id, chosen_slot_id }) }),
  registerCourse: (section_id, chosen_slot_id) =>
    request('/register', { method: 'POST', body: JSON.stringify({ section_id, chosen_slot_id }) }),
  dropEnrollment: (id) => request(`/drop/${id}`, { method: 'POST' }),

  // Grade card & transcript
  getGradeCard: (semesterId) => request(`/grade-card/${semesterId}`),
  getTranscript: () => request('/transcript'),

  // Exam registration (student)
  getExamRegistrations: () => request('/exam-registrations'),
  registerForExam: (enrollmentId) =>
    request(`/exam-register/${enrollmentId}`, { method: 'POST', body: '{}' }),
  getMyExamRegistrations: () => request('/my-exam-registrations'),

  // Admin / Staff
  syncSectionsFromPreferences: () =>
    request('/sync-sections-from-preferences', { method: 'POST', body: JSON.stringify({}) }),
  getInstructorPreferences: () => request('/instructor-preferences'),
  createCourse: (data) => request('/courses', { method: 'POST', body: JSON.stringify(data) }),
  createSection: (data) => request('/sections', { method: 'POST', body: JSON.stringify(data) }),
  createSemester: (data) => request('/semesters', { method: 'POST', body: JSON.stringify(data) }),
  toggleRegistration: (semesterId, registration_open) =>
    request(`/semesters/${semesterId}/registration`, { method: 'PATCH', body: JSON.stringify({ registration_open }) }),
  toggleExamsCompleted: (semesterId, exams_completed) =>
    request(`/semesters/${semesterId}/exams`, { method: 'PATCH', body: JSON.stringify({ exams_completed }) }),

  // Instructor sections & results
  getInstructorSections: () => request('/instructor/my-sections'),
  getInstructorResultSections: () => request('/instructor/results/sections'),
  getSectionResultStudents: (sectionId) => request(`/instructor/results/sections/${sectionId}/students`),
  saveExamResult: (enrollment_id, marks) =>
    request('/instructor/results', { method: 'POST', body: JSON.stringify({ enrollment_id, marks }) }),

  // Instructor exam requests & timetable
  requestExam: (sectionId) =>
    request(`/instructor/sections/${sectionId}/request-exam`, { method: 'POST', body: '{}' }),
  cancelExamRequest: (sectionId) =>
    request(`/instructor/sections/${sectionId}/cancel-exam-request`, { method: 'POST', body: '{}' }),
  updateSectionTimetable: (sectionId, data) =>
    request(`/instructor/sections/${sectionId}/timetable`, { method: 'POST', body: JSON.stringify(data) }),

  // Staff grade workflow
  getWorkflowSections: () => request('/workflow/sections/pending'),
  getWorkflowSectionResults: (sectionId) => request(`/workflow/sections/${sectionId}/results`),
  forwardToHod: (sectionId) =>
    request(`/workflow/sections/${sectionId}/forward-hod`, { method: 'POST' }),
  publishResults: (sectionId) =>
    request(`/workflow/sections/${sectionId}/publish`, { method: 'POST' }),

  // Staff exam registration management
  getExamRequests: () => request('/workflow/exam-requests'),
  openExamReg: (sectionId) =>
    request(`/workflow/sections/${sectionId}/open-exam-reg`, { method: 'POST' }),
  closeExamReg: (sectionId) =>
    request(`/workflow/sections/${sectionId}/close-exam-reg`, { method: 'POST' }),
  getSectionExamRegistrations: (sectionId) =>
    request(`/workflow/sections/${sectionId}/exam-registrations`),

  // User Management
  getUsers: () => request('/workflow/users'),
  deleteUser: (userId) => request(`/workflow/users/${userId}`, { method: 'DELETE' }),

  // HOD workflow
  getDeptHeadCourses: () => request('/workflow/dept-head/courses'),
  hodApproveStudent: (enrollmentId) =>
    request(`/workflow/enrollments/${enrollmentId}/hod-approve`, { method: 'POST' }),
  hodRejectStudent: (enrollmentId) =>
    request(`/workflow/enrollments/${enrollmentId}/hod-reject`, { method: 'POST' }),
  hodApproveAll: (sectionId) =>
    request(`/workflow/sections/${sectionId}/hod-approve-all`, { method: 'POST' }),

  // Marks & assessment
  getSectionComponents: (sectionId) => request(`/instructor/sections/${sectionId}/components`),
  getSectionMarks: (sectionId) => request(`/instructor/sections/${sectionId}/marks`),
  getRevisionRequests: () => request('/instructor/revision-requests'),
  reviewRevision: (id, status) =>
    request(`/instructor/revision-requests/${id}/review`, { method: 'POST', body: JSON.stringify({ status }) }),
};
