import React, { useContext } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import BottomNav from './BottomNav';
import { AuthContext } from '../AuthContext';

const Layout = () => {
  const { currentUser } = useContext(AuthContext);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 transition-colors">
      <Navbar />
      <div className="pt-0">
        <Outlet />
      </div>
      {currentUser && <BottomNav />}
    </div>
  );
};

export default Layout;
