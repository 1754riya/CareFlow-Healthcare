import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export function SpecialtyCard({ icon, name, to, onClick }) {
  const content = (
    <>
      <div className="w-16 h-16 bg-white dark:bg-slate-700 rounded-2xl flex items-center justify-center mb-3 overflow-hidden shadow-sm">
        <img src={icon} alt={name} className="w-10 h-10 object-contain" />
      </div>
      <span className="text-gray-700 dark:text-gray-200 text-xs text-center font-semibold leading-snug">{name}</span>
    </>
  );

  const cls =
    'flex flex-col items-center justify-center bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-5 hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-700 transition-all cursor-pointer';

  if (to) {
    return (
      <motion.div whileHover={{ y: -4 }} whileTap={{ scale: 0.96 }}>
        <Link to={to} className={cls}>{content}</Link>
      </motion.div>
    );
  }

  return (
    <motion.div whileHover={{ y: -4 }} whileTap={{ scale: 0.96 }}>
      <div onClick={onClick} className={cls}>{content}</div>
    </motion.div>
  );
}
