import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FcGoogle } from 'react-icons/fc';
import { SocialButton } from './SocialButton';
import { InputField } from './InputField';
import { auth, googleProvider, db } from '../firebase/config';
import { createUserWithEmailAndPassword, signInWithPopup } from '@firebase/auth';
import { doc, setDoc, serverTimestamp } from '@firebase/firestore';

function friendlyAuthError(code) {
  switch (code) {
    case 'auth/popup-blocked':
      return 'Popup was blocked by your browser. Please allow popups for this site and try again.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return null;
    case 'auth/unauthorized-domain':
      return 'This domain is not authorised for Google Sign-In. Please contact support.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Please log in instead.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/network-request-failed':
      return 'Network error. Check your internet connection and try again.';
    default:
      return null;
  }
}

const generateSearchKeywords = (name, specialty) => {
  const words = [...name.toLowerCase().split(' '), ...specialty.toLowerCase().split(' ')];
  return [...new Set([name.toLowerCase(), specialty.toLowerCase(), ...words])];
};

export default function SignupPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    specialty: '',
    location: '',
    licenseNumber: '',
    experience: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [userType, setUserType] = useState('patient');
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  /* Email/password signup */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const { email, password, firstName, lastName, specialty, location, licenseNumber, experience } = formData;
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      const name = `${firstName} ${lastName}`.trim();

      let userData = {
        uid: user.uid,
        firstName,
        lastName,
        email,
        role: userType,
        createdAt: serverTimestamp(),
      };

      let collectionName = 'patients';

      if (userType === 'doctor') {
        collectionName = 'doctors';
        userData = {
          ...userData,
          specialty,
          location,
          name,
          experience: experience ? parseInt(experience, 10) : null,
          licenseNumber: licenseNumber || null,
          verified: false,
          searchKeywords: generateSearchKeywords(name, specialty),
        };
      }

      await setDoc(doc(db, collectionName, user.uid), userData);
      navigate(userType === 'doctor' ? '/dashboard' : '/');
    } catch (err) {
      const msg = friendlyAuthError(err.code);
      setError(msg || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  /* Google signup — uses merge:true so re-signing doesn't overwrite existing data */
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      const { user } = await signInWithPopup(auth, googleProvider);
      const displayName = user.displayName || '';
      const nameParts = displayName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      const name = displayName;

      let userData = {
        uid: user.uid,
        firstName,
        lastName,
        name,
        email: user.email,
        role: userType,
        photoURL: user.photoURL || '',
        createdAt: serverTimestamp(),
      };

      let collectionName = 'patients';

      if (userType === 'doctor') {
        collectionName = 'doctors';
        userData = {
          ...userData,
          specialty: formData.specialty,
          location: formData.location,
          verified: false,
          searchKeywords: generateSearchKeywords(name, formData.specialty || ''),
        };
      }

      await setDoc(doc(db, collectionName, user.uid), userData, { merge: true });
      navigate(userType === 'doctor' ? '/dashboard' : '/');
    } catch (err) {
      const msg = friendlyAuthError(err.code);
      if (msg !== null) {
        setError(msg || err.message);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const busy = submitting || googleLoading;

  return (
    <div className="min-h-screen flex text-left">
      {/* Left Side — Form */}
      <div className="w-full lg:w-1/2 px-5 py-8 sm:p-8 flex flex-col justify-center">
        <div className="max-w-md mx-auto w-full">

          {/* Mobile brand header */}
          <div className="lg:hidden flex items-center gap-3 mb-6">
            <img src="/Logo2.png" alt="CareFlow" className="w-10 h-10 object-contain" />
            <div>
              <p className="font-black text-lg bg-gradient-to-r from-green-600 via-blue-600 to-orange-500 bg-clip-text text-transparent leading-none">CareFlow</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">Appointment & Follow-up Manager</p>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Create a free account</h1>
          <p className="text-gray-500 mb-6">Sign up as a</p>

          {/* Toggle User Type */}
          <div className="flex mb-6 rounded-lg overflow-hidden border border-gray-200">
            <button
              type="button"
              disabled={busy}
              className={`flex-1 py-3 font-medium transition-colors ${
                userType === 'patient' ? 'bg-green-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
              onClick={() => setUserType('patient')}
            >
              Patient
            </button>
            <button
              type="button"
              disabled={busy}
              className={`flex-1 py-3 font-medium transition-colors ${
                userType === 'doctor' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
              onClick={() => setUserType('doctor')}
            >
              Doctor
            </button>
          </div>

          {/* Google Sign-Up */}
          <SocialButton
            icon={FcGoogle}
            provider="Google"
            className="bg-blue-600 mb-3"
            onClick={handleGoogleSignIn}
            loading={googleLoading}
            disabled={busy}
          />

          {/* Separator */}
          <div className="my-6 flex items-center">
            <div className="flex-1 border-t border-gray-300" />
            <span className="px-4 text-gray-500 text-sm">OR</span>
            <div className="flex-1 border-t border-gray-300" />
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Sign-Up Form */}
          <form onSubmit={handleSubmit}>
            <InputField
              label="First Name"
              placeholder="Alexa"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              required
              disabled={busy}
            />

            <InputField
              label="Last Name"
              placeholder="Mathew"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              required
              disabled={busy}
            />

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
              placeholder="Min. 6 characters"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={6}
              disabled={busy}
            />

            {/* Doctor-only fields */}
            {userType === 'doctor' && (
              <>
                <InputField
                  label="Specialty"
                  placeholder="Cardiologist"
                  name="specialty"
                  value={formData.specialty}
                  onChange={handleChange}
                  required
                  disabled={busy}
                />
                <InputField
                  label="Location"
                  placeholder="Mumbai"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  required
                  disabled={busy}
                />
                <InputField
                  label="Years of Experience"
                  type="number"
                  placeholder="5"
                  name="experience"
                  value={formData.experience}
                  onChange={handleChange}
                  disabled={busy}
                />
                <InputField
                  label="Medical License Number (optional)"
                  placeholder="MCI-2024-XXXXX"
                  name="licenseNumber"
                  value={formData.licenseNumber}
                  onChange={handleChange}
                  disabled={busy}
                />
              </>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-green-500 text-white py-3 rounded-lg font-medium hover:bg-green-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-4"
            >
              {submitting && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {submitting ? 'Creating account...' : userType === 'doctor' ? 'Sign up as Doctor' : 'Sign up as Patient'}
            </button>
          </form>

          <p className="text-center text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>

      {/* Right Side — Branding */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-green-50 to-blue-100 p-8 flex-col items-center justify-center">
        <div className="w-72 h-72 bg-white rounded-full mb-8 flex items-center justify-center shadow-lg shadow-blue-200/50 p-8">
          <img src="/Logo2.png" alt="CareFlow" className="w-full h-full object-contain" />
        </div>
        <h2 className="text-3xl font-bold mb-4 text-gray-800">Welcome to CareFlow</h2>
        <p className="text-gray-600 text-center max-w-md leading-relaxed">
          "Your health, your control — CareFlow simplifies care, secures your records, and keeps every appointment and follow-up on track."
        </p>
      </div>
    </div>
  );
}
