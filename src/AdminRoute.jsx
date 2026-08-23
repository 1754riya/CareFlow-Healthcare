import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from './AuthContext';

export default function AdminRoute({ children }) {
  const { currentUser, userType } = useContext(AuthContext);
  if (!currentUser) return <Navigate to="/login" replace />;
  if (userType !== 'admin') return <Navigate to="/" replace />;
  return children;
}
