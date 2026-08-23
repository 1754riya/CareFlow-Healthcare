import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import ErrorBoundary from './ErrorBoundary.jsx';
import { AuthProvider } from './AuthContext.jsx';
import { ToastProvider } from './components/Toast.jsx';
import PrivateRoute from './PrivateRoute.jsx';
import AdminRoute from './AdminRoute.jsx';
import Layout from './components/layout.jsx';

/* Eagerly loaded (always needed) */
import App           from './App.jsx';
import CustomCursor  from './components/CustomCursor.jsx';

/* Lazy loaded — splits the bundle per route */
const Dashboard      = lazy(() => import('./doc-dashboard/dashboard.jsx'));
const SignupPage      = lazy(() => import('./signup/signup.jsx'));
const LoginPage       = lazy(() => import('./login/login.jsx'));
const SearchPage      = lazy(() => import('./search/search.jsx'));
const StartPage       = lazy(() => import('./doc-dashboard/start/start.jsx'));
const View            = lazy(() => import('./search/view.jsx'));
const Appointments    = lazy(() => import('./appointments/appointments.jsx'));
const Settings        = lazy(() => import('./settings/settings.jsx'));
const About           = lazy(() => import('./about/About.jsx'));
const MedicalRecords  = lazy(() => import('./medical-records/MedicalRecords.jsx'));
const FAQ             = lazy(() => import('./faq/FAQ.jsx'));
const BMITracker      = lazy(() => import('./bmi-tracker/BMITracker.jsx'));
const AdminDashboard  = lazy(() => import('./admin-dashboard/AdminDashboard.jsx'));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 px-4">
      <div className="text-center">
        <p className="text-8xl font-black text-gray-100 dark:text-slate-800 mb-4 select-none">404</p>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Page not found</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-colors"
        >
          ← Back to Home
        </a>
      </div>
    </div>
  );
}

/* Inner component so AnimatePresence can read useLocation */
function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        {/* Routes using Layout (Navbar + BottomNav) */}
        <Route path="/" element={<Layout />}>
          <Route index element={<App />} />
          <Route path="search"        element={<SearchPage />} />
          <Route path="view"          element={<View />} />
          <Route path="about"         element={<About />} />
          <Route path="faq"           element={<FAQ />} />
          <Route path="bmi-tracker"   element={<BMITracker />} />

          <Route path="appointments"    element={<PrivateRoute><Appointments /></PrivateRoute>} />
          <Route path="settings"        element={<PrivateRoute><Settings /></PrivateRoute>} />
          <Route path="medical-records" element={<PrivateRoute><MedicalRecords /></PrivateRoute>} />
        </Route>

        {/* Auth routes — no Layout */}
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login"  element={<LoginPage />} />

        {/* Doctor routes — no Layout */}
        <Route path="/dashboard"       element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/dashboard/start" element={<PrivateRoute><StartPage /></PrivateRoute>} />

        {/* Admin routes — no Layout */}
        <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <CustomCursor />
          <Router>
            <Suspense fallback={<PageLoader />}>
              <AnimatedRoutes />
            </Suspense>
          </Router>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);
