import React, { createContext, useState, useEffect } from 'react';
import { auth, db } from './firebase/config';
import { onAuthStateChanged } from '@firebase/auth';
import { doc, getDoc } from '@firebase/firestore';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userType, setUserType] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Fetch user type
        try {
          const adminDoc = await getDoc(doc(db, 'admins', user.uid));
          if (adminDoc.exists()) {
            setUserType('admin');
          } else {
            const patientDoc = await getDoc(doc(db, 'patients', user.uid));
            if (patientDoc.exists()) {
              setUserType('patient');
            } else {
              const doctorDoc = await getDoc(doc(db, 'doctors', user.uid));
              if (doctorDoc.exists()) {
                setUserType('doctor');
              } else {
                setUserType(null);
              }
            }
          }
        } catch (error) {
          console.error('Error fetching user type:', error);
          setUserType(null);
        }
      } else {
        setUserType(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, userType, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};