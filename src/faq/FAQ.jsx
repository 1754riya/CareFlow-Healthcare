import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Search, MessageCircle, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageTransition from '../components/PageTransition';

const FAQS = [
  {
    category: 'Getting Started',
    items: [
      {
        q: 'How do I create an account on CareFlow?',
        a: 'Click "Get Started" in the top navigation. You can register with your email and password, or sign in instantly with your Google account. Choose between Patient or Doctor during registration.',
      },
      {
        q: 'Is CareFlow free to use?',
        a: 'Yes! Creating an account and searching for doctors is completely free. You can browse doctor profiles, read reviews, and book appointments at no charge.',
      },
      {
        q: 'Can I use CareFlow on my phone?',
        a: 'Absolutely. CareFlow is fully responsive and works on all devices. The mobile experience includes a bottom navigation bar for quick access to all features.',
      },
    ],
  },
  {
    category: 'Booking Appointments',
    items: [
      {
        q: 'How do I book an appointment with a doctor?',
        a: 'Search for a doctor using the search bar, browse their profile, then click "Book Appointment". Select an available time slot from the doctor\'s calendar and confirm your booking.',
      },
      {
        q: 'Can I cancel or reschedule an appointment?',
        a: 'Yes. Go to "My Appointments" in your dashboard, find the appointment you want to modify, and click "Reschedule" to pick a new available slot, or "Cancel" to cancel it entirely.',
      },
      {
        q: 'What do the appointment statuses mean?',
        a: 'Pending: Your booking request is submitted. Confirmed: Doctor has confirmed the appointment. In Progress: Your appointment is currently active. Completed: The appointment is done. Cancelled: The appointment was cancelled.',
      },
      {
        q: 'How far in advance can I book?',
        a: 'Booking availability depends on the individual doctor\'s calendar settings. Most doctors set their availability on a weekly basis, and you can book any open slot they\'ve published.',
      },
    ],
  },
  {
    category: 'Finding Doctors',
    items: [
      {
        q: 'How do I search for a specific type of doctor?',
        a: 'Use the search bar on the home page or the Find Doctors page. You can search by name, specialty, or location. Use the Filters panel to narrow results by experience level or minimum rating.',
      },
      {
        q: 'What does the "Verified" badge mean?',
        a: 'The blue Verified badge indicates that the doctor\'s medical license has been reviewed and confirmed. Verified doctors have submitted their credentials and been approved by our team.',
      },
      {
        q: 'How are doctor ratings calculated?',
        a: 'Ratings are based on reviews submitted by patients who have completed appointments with that doctor. Only verified patients who have had an actual appointment can leave a review.',
      },
    ],
  },
  {
    category: 'Medical Records & Privacy',
    items: [
      {
        q: 'Where are my medical records stored?',
        a: 'Your medical records are securely stored in Firebase (Google Cloud) with industry-standard encryption. Only you can access your records — they are linked to your authenticated account.',
      },
      {
        q: 'Can doctors see my medical records?',
        a: 'No. Your medical records in the Medical Records section are private and only accessible to you. Doctors can only see information related to your bookings.',
      },
      {
        q: 'How do I add or update my medical information?',
        a: 'Go to Medical Records from the navigation menu. You can add allergies, medications, chronic conditions, vitals (height/weight/BMI), and emergency contact information.',
      },
    ],
  },
  {
    category: 'For Doctors',
    items: [
      {
        q: 'How do I register as a doctor?',
        a: 'On the Sign Up page, select "Doctor" instead of "Patient". Fill in your specialty, location, and optionally your license number and years of experience. You\'ll be redirected to your doctor dashboard.',
      },
      {
        q: 'How do I set my availability?',
        a: 'From your Doctor Dashboard, click "Set Availability". You can enable specific days, choose time slots using presets or manually, copy settings to all days, and block specific dates for holidays.',
      },
      {
        q: 'How do I get the Verified badge?',
        a: 'Contact the CareFlow team with your medical license number and credentials. After verification, the badge will be added to your profile to build patient trust.',
      },
      {
        q: 'Can patients leave reviews?',
        a: 'Yes. Patients who have completed an appointment with you can leave a star rating and written review on your profile. You can see all reviews on your profile page.',
      },
    ],
  },
  {
    category: 'Technical Support',
    items: [
      {
        q: 'Google login isn\'t working. What should I do?',
        a: 'First, make sure popups are not blocked in your browser. Check that you\'re not in Incognito/Private mode. If the issue persists, try the email/password login or contact support.',
      },
      {
        q: 'The app seems slow. How can I improve performance?',
        a: 'Try refreshing the page. Clear your browser cache. Ensure you have a stable internet connection. The app uses real-time Firestore listeners which require a live connection.',
      },
      {
        q: 'I found a bug. How do I report it?',
        a: 'We appreciate bug reports! Contact us through the About page and include what you were doing and what error appeared.',
      },
    ],
  },
];

function AccordionItem({ item, isOpen, onToggle }) {
  return (
    <div className="border border-gray-100 dark:border-slate-700 rounded-2xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-750 transition-colors gap-4"
        aria-expanded={isOpen}
      >
        <span className="font-medium text-gray-900 dark:text-white text-sm leading-snug">{item.q}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0"
        >
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
          >
            <div className="px-5 pb-5 pt-1 bg-white dark:bg-slate-800 border-t border-gray-50 dark:border-slate-700">
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{item.a}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQ() {
  const [search, setSearch] = useState('');
  const [openItem, setOpenItem] = useState(null);
  const [activeCategory, setActiveCategory] = useState('All');

  const categories = ['All', ...FAQS.map(f => f.category)];

  const filtered = FAQS
    .map(section => ({
      ...section,
      items: section.items.filter(item =>
        item.q.toLowerCase().includes(search.toLowerCase()) ||
        item.a.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter(section =>
      (activeCategory === 'All' || section.category === activeCategory) &&
      section.items.length > 0
    );

  const totalResults = filtered.reduce((s, sec) => s + sec.items.length, 0);

  return (
    <PageTransition>
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pt-16 pb-24 md:pb-8">

        {/* Hero */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 py-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 bg-white/20 text-white text-xs font-semibold px-3 py-1.5 rounded-full mb-4"
            >
              <HelpCircle className="w-3.5 h-3.5" /> Help Center
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="text-3xl md:text-4xl font-bold text-white mb-4"
            >
              Frequently Asked Questions
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-blue-100 mb-8"
            >
              Find answers to common questions about CareFlow
            </motion.p>

            {/* Search */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="relative max-w-xl mx-auto"
            >
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search questions..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 shadow-lg focus:outline-none focus:ring-2 focus:ring-white/50 text-sm"
              />
            </motion.div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-8">

          {/* Category tabs */}
          <div className="flex gap-2 flex-wrap mb-8">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  activeCategory === cat
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-none'
                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:border-blue-400'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {search && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {totalResults} result{totalResults !== 1 ? 's' : ''} for "{search}"
            </p>
          )}

          {/* FAQ sections */}
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <HelpCircle className="w-12 h-12 text-gray-200 dark:text-slate-600 mx-auto mb-3" />
              <p className="font-medium text-gray-500 dark:text-gray-400">No results found</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Try a different search term</p>
            </div>
          ) : (
            <div className="space-y-8">
              {filtered.map(section => (
                <motion.div
                  key={section.category}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <h2 className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">
                    {section.category}
                  </h2>
                  <div className="space-y-2">
                    {section.items.map((item, idx) => {
                      const key = `${section.category}-${idx}`;
                      return (
                        <AccordionItem
                          key={key}
                          item={item}
                          isOpen={openItem === key}
                          onToggle={() => setOpenItem(openItem === key ? null : key)}
                        />
                      );
                    })}
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Still need help CTA */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-8 text-center text-white"
          >
            <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-80" />
            <h3 className="text-xl font-bold mb-2">Still have questions?</h3>
            <p className="text-blue-100 text-sm mb-5">
              Learn more about CareFlow or reach out to our team.
            </p>
            <Link
              to="/about"
              className="inline-flex items-center gap-2 bg-white text-blue-600 font-semibold px-6 py-3 rounded-xl hover:bg-blue-50 transition-colors text-sm"
            >
              Visit About →
            </Link>
          </motion.div>
        </div>
      </div>
    </PageTransition>
  );
}
