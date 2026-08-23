import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FcGoogle } from 'react-icons/fc';
import { SocialButton } from '../signup/SocialButton';
import { InputField } from '../signup/InputField';
import { auth, googleProvider, db } from '../firebase/config';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  sendPasswordResetEmail,
} from '@firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from '@firebase/firestore';

function friendlyAuthError(code) {
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return null; // user cancelled — show nothing
    case 'auth/popup-blocked':
      return null; // handled by redirect fallback
    case 'auth/unauthorized-domain':
      return 'This domain is not authorised for Google Sign-In. Add it in Firebase Console → Authentication → Settings → Authorised domains.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password. Please try again.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your internet connection and try again.';
    default:
      return 'Sign-in failed. Please try again.';
  }
}

export default function LoginPage() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  const navigate = useNavigate();

  /* Handle redirect result — only runs if we deliberately triggered a redirect */
  useEffect(() => {
    const pending = sessionStorage.getItem('googleRedirectPending');
    if (!pending) return;
    sessionStorage.removeItem('googleRedirectPending');
    setGoogleLoading(true);
    getRedirectResult(auth)
      .then(result => { if (result?.user) return handleGoogleUser(result.user); })
      .catch(err => {
        const msg = friendlyAuthError(err.code);
        if (msg) setError(msg);
      })
      .finally(() => setGoogleLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  /* Shared: look up Firestore role and redirect, or create patient on first Google login */
  const handleGoogleUser = async (user) => {
    const adminSnap = await getDoc(doc(db, 'admins', user.uid));
    if (adminSnap.exists()) { navigate('/admin'); return; }

    const patientSnap = await getDoc(doc(db, 'patients', user.uid));
    if (patientSnap.exists()) { navigate('/'); return; }

    const doctorSnap = await getDoc(doc(db, 'doctors', user.uid));
    if (doctorSnap.exists()) { navigate('/dashboard'); return; }

    // First-time Google login — auto-create patient profile
    const displayName = user.displayName || '';
    const nameParts = displayName.trim().split(' ');
    await setDoc(doc(db, 'patients', user.uid), {
      uid: user.uid,
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      name: displayName,
      email: user.email,
      photoURL: user.photoURL || '',
      role: 'patient',
      createdAt: serverTimestamp(),
    });
    navigate('/');
  };

  /* Email/password login */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { user } = await signInWithEmailAndPassword(auth, formData.email, formData.password);
      const adminSnap = await getDoc(doc(db, 'admins', user.uid));
      if (adminSnap.exists()) { navigate('/admin'); return; }
      const patientSnap = await getDoc(doc(db, 'patients', user.uid));
      if (patientSnap.exists()) { navigate('/'); return; }
      const doctorSnap = await getDoc(doc(db, 'doctors', user.uid));
      if (doctorSnap.exists()) { navigate('/dashboard'); return; }
      setError('Account not found. Please sign up first.');
    } catch (err) {
      const msg = friendlyAuthError(err.code);
      if (msg) setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  /* Google Sign-In — popup with redirect fallback if popup is blocked */
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      const { user } = await signInWithPopup(auth, googleProvider);
      await handleGoogleUser(user);
    } catch (err) {
      if (err.code === 'auth/popup-blocked') {
        sessionStorage.setItem('googleRedirectPending', '1');
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      const msg = friendlyAuthError(err.code);
      if (msg) setError(msg);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleShowResetModal = () => {
    setResetEmail('');
    setResetError('');
    setResetSuccess('');
    setShowResetModal(true);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setIsResetting(true);
    setResetError('');
    setResetSuccess('');
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetSuccess('Password reset email sent. Please check your inbox.');
    } catch (err) {
      setResetError('Failed to send reset email. Please check the address and try again.');
    } finally {
      setIsResetting(false);
    }
  };

  const busy = submitting || googleLoading;

  return (
    <div className="min-h-screen flex text-left">
      {/* Left Side — Form */}
      <div className="w-full lg:w-1/2 px-5 py-8 sm:p-8 flex flex-col justify-center">
        <div className="max-w-md mx-auto w-full">

          {/* Mobile brand header — hidden when right panel shows */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <img src="/logo.png" alt="CareFlow" className="w-10 h-10 object-contain" />
            <div>
              <p className="font-black text-lg bg-gradient-to-r from-green-600 via-blue-600 to-orange-500 bg-clip-text text-transparent leading-none">CareFlow</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">Appointment & Follow-up Manager</p>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold mb-8">Log in to your account</h1>

          <SocialButton
            icon={FcGoogle}
            provider="Google"
            className="bg-blue-600 mb-3"
            onClick={handleGoogleSignIn}
            loading={googleLoading}
            disabled={busy}
          />

          <div className="my-6 flex items-center">
            <div className="flex-1 border-t border-gray-300" />
            <span className="px-4 text-gray-500 text-sm">OR</span>
            <div className="flex-1 border-t border-gray-300" />
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <InputField
              label="Email Address"
              type="email"
              placeholder="abc@example.com"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              disabled={busy}
            />

            <InputField
              label="Password"
              type="password"
              placeholder="••••••••"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              disabled={busy}
            />

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-blue-500 text-white py-3 rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-4"
            >
              {submitting && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {submitting ? 'Signing in...' : 'Log In'}
            </button>

            <div className="text-right">
              <button
                type="button"
                onClick={handleShowResetModal}
                className="text-blue-600 hover:underline text-sm"
              >
                Forgot Password?
              </button>
            </div>
          </form>

          <p className="text-center text-gray-600 mt-4">
            Don't have an account?{' '}
            <Link to="/signup" className="text-blue-600 hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>

      {/* Right Side — Branding */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-blue-50 to-indigo-100 p-8 flex-col items-center justify-center">
        <div className="w-72 h-72 bg-white rounded-full mb-8 flex items-center justify-center shadow-lg shadow-blue-200/50 p-8">
          <img src="/Logo2.png" alt="CareFlow" className="w-full h-full object-contain" />
        </div>
        <h2 className="text-3xl font-bold mb-4 text-gray-800">Welcome to CareFlow</h2>
        <p className="text-gray-600 text-center max-w-md leading-relaxed">
          "Your health, your control — CareFlow simplifies care, secures your records, and keeps every appointment and follow-up on track."
        </p>
      </div>

      {/* Reset Password Modal */}
      {showResetModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4">Reset Password</h2>
            {resetError && <p className="text-red-500 text-sm mb-4">{resetError}</p>}
            {resetSuccess && <p className="text-green-600 text-sm mb-4">{resetSuccess}</p>}
            {!resetSuccess ? (
              <form onSubmit={handleResetPassword}>
                <InputField
                  label="Email Address"
                  type="email"
                  placeholder="abc@example.com"
                  name="resetEmail"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                />
                <div className="flex items-center justify-end mt-4 gap-3">
                  <button
                    type="button"
                    onClick={() => setShowResetModal(false)}
                    className="text-gray-600 hover:underline text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isResetting}
                    className="bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isResetting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    {isResetting ? 'Sending...' : 'Send Reset Email'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
