import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import StudentDashboard from './pages/StudentDashboard';
import CourseRegistration from './pages/CourseRegistration';
import GradeCard from './pages/GradeCard';
import Transcript from './pages/Transcript';
import InstructorDashboard from './pages/InstructorDashboard';
import InstructorResults from './pages/InstructorResults';
import MarksEntry from './pages/MarksEntry';
import AdminDashboard from './pages/AdminDashboard';
import StaffGradeWorkflow from './pages/StaffGradeWorkflow';
import DeptHeadReview from './pages/DeptHeadReview';
import RevisionRequests from './pages/RevisionRequests';
import StudentProfileOverlay from './components/StudentProfileOverlay';
import InstructorProfileOverlay from './components/InstructorProfileOverlay';
import './App.css';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function ProfileGate({ children }) {
  const { user, needsProfileSetup, completeProfileSetup } = useAuth();

  if (user?.role === 'student' && needsProfileSetup()) {
    return <StudentProfileOverlay onComplete={completeProfileSetup} />;
  }
  if (user?.role === 'instructor' && needsProfileSetup()) {
    return <InstructorProfileOverlay onComplete={completeProfileSetup} />;
  }
  return children;
}

function HomeRouter() {
  const { user } = useAuth();
  if (user?.role === 'instructor') return <InstructorDashboard />;
  if (['admin', 'academic_staff'].includes(user?.role)) return <AdminDashboard />;
  if (user?.role === 'dept_head') return <DeptHeadReview />;
  return <StudentDashboard />;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Loading...</div>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route element={
        <ProtectedRoute>
          <ProfileGate>
            <Layout />
          </ProfileGate>
        </ProtectedRoute>
      }>
        <Route path="/" element={<HomeRouter />} />
        <Route path="/register" element={<ProtectedRoute roles={['student']}><CourseRegistration /></ProtectedRoute>} />
        <Route path="/grades" element={<ProtectedRoute roles={['student']}><GradeCard /></ProtectedRoute>} />
        <Route path="/transcript" element={<ProtectedRoute roles={['student']}><Transcript /></ProtectedRoute>} />
        <Route path="/results" element={<ProtectedRoute roles={['instructor']}><InstructorResults /></ProtectedRoute>} />
        <Route path="/marks/:sectionId" element={<ProtectedRoute roles={['instructor']}><MarksEntry /></ProtectedRoute>} />
        <Route path="/grade-workflow" element={<ProtectedRoute roles={['academic_staff', 'admin']}><StaffGradeWorkflow /></ProtectedRoute>} />
        <Route path="/hod-review" element={<ProtectedRoute roles={['dept_head', 'admin']}><DeptHeadReview /></ProtectedRoute>} />
        <Route path="/revisions" element={<ProtectedRoute roles={['dept_head', 'admin', 'academic_staff']}><RevisionRequests /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
