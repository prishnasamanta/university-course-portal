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
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  me: () => request('/auth/me'),

  saveStudentProfile: (data) =>
    request('/profile/student', { method: 'POST', body: JSON.stringify(data) }),

  saveInstructorProfile: (preferences) =>
    request('/instructor/profile', { method: 'POST', body: JSON.stringify({ preferences }) }),

  getInstructorAvailableCourses: () => request('/instructor/available-courses'),

  getCourses: () => request('/courses'),
  getInstructors: () => request('/instructors'),
  getSemesters: () => request('/semesters'),
  getOfferings: (semesterId) => request(`/offerings/${semesterId}`),
  getCourseDetail: (courseId, semesterId) => request(`/courses/${courseId}/semester/${semesterId}`),
  getMyEnrollments: () => request('/my-enrollments'),
  validateRegistration: (section_id, chosen_slot_id) =>
    request('/register/validate', { method: 'POST', body: JSON.stringify({ section_id, chosen_slot_id }) }),
  register: (section_id, chosen_slot_id) =>
    request('/register', { method: 'POST', body: JSON.stringify({ section_id, chosen_slot_id }) }),
  dropEnrollment: (id) => request(`/drop/${id}`, { method: 'POST' }),
  getGradeCard: (semesterId) => request(`/grade-card/${semesterId}`),
  getTranscript: () => request('/transcript'),

  syncSectionsFromPreferences: () =>
    request('/sync-sections-from-preferences', { method: 'POST', body: JSON.stringify({}) }),
  getInstructorPreferences: () => request('/instructor-preferences'),
  createCourse: (data) => request('/courses', { method: 'POST', body: JSON.stringify(data) }),
  createSection: (data) => request('/sections', { method: 'POST', body: JSON.stringify(data) }),
  toggleRegistration: (semesterId, registration_open) =>
    request(`/semesters/${semesterId}/registration`, { method: 'PATCH', body: JSON.stringify({ registration_open }) }),
  toggleExamsCompleted: (semesterId, exams_completed) =>
    request(`/semesters/${semesterId}/exams`, { method: 'PATCH', body: JSON.stringify({ exams_completed }) }),

  getInstructorSections: () => request('/instructor/my-sections'),
  getInstructorResultSections: () => request('/instructor/results/sections'),
  getSectionResultStudents: (sectionId) => request(`/instructor/results/sections/${sectionId}/students`),
  saveExamResult: (enrollment_id, marks) =>
    request('/instructor/results', { method: 'POST', body: JSON.stringify({ enrollment_id, marks }) }),

  getWorkflowSections: () => request('/workflow/sections/pending'),
  getWorkflowSectionResults: (sectionId) => request(`/workflow/sections/${sectionId}/results`),
  forwardToHod: (sectionId) => request(`/workflow/sections/${sectionId}/forward-hod`, { method: 'POST' }),
  publishResults: (sectionId) => request(`/workflow/sections/${sectionId}/publish`, { method: 'POST' }),

  getDeptHeadCourses: () => request('/workflow/dept-head/courses'),
  hodApproveStudent: (enrollmentId) => request(`/workflow/enrollments/${enrollmentId}/hod-approve`, { method: 'POST' }),
  hodRejectStudent: (enrollmentId) => request(`/workflow/enrollments/${enrollmentId}/hod-reject`, { method: 'POST' }),
  hodApproveAll: (sectionId) => request(`/workflow/sections/${sectionId}/hod-approve-all`, { method: 'POST' }),

  getSectionComponents: (sectionId) => request(`/instructor/sections/${sectionId}/components`),
  getSectionMarks: (sectionId) => request(`/instructor/sections/${sectionId}/marks`),
  getRevisionRequests: () => request('/instructor/revision-requests'),
  reviewRevision: (id, status) =>
    request(`/instructor/revision-requests/${id}/review`, { method: 'POST', body: JSON.stringify({ status }) }),
};
