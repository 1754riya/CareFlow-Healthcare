# CareFlow — Healthcare Appointment & Follow-up Manager

A full-stack, portfolio-grade healthcare platform connecting patients with doctors. Built with React 18, Firebase, and Tailwind CSS.

![CareFlow](public/logo.png)

## Features

### Patient
- **Find Doctors** — Search by name, specialty, or location with real-time Firestore pagination
- **Book Appointments** — React Calendar with real-time slot availability and instant confirmation
- **Medical Records** — Allergies, medications, conditions, family history, vitals, and emergency contacts
- **Health Tracker** — BMI calculator, meal planner, medication reminders, and progress history
- **Appointments Dashboard** — View upcoming, past, and cancelled appointments
- **Real-Time Notifications** — Instant updates for appointment confirmations, completions, and reviews

### Doctor
- **Doctor Dashboard** — View upcoming appointments, manage availability, and see patient stats
- **Set Availability** — Define available time slots for patient booking
- **Patient Reviews** — Receive ratings and reviews after completed appointments
- **Verification Badge** — License number submission with verified badge on profile

### Platform
- **Custom Animated Cursor** — Glowing dot + spring-lagged ring; disabled automatically on touch devices
- **Dark Mode** — Full dark mode support across all pages
- **Fully Responsive** — Mobile-first design with bottom navigation, touch-friendly targets (44×44px min)

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React 18 + Vite 6 | Component-based UI with Concurrent Mode; Vite provides near-instant HMR and automatic code splitting — 10–100x faster than CRA |
| Routing | React Router v7 | Nested routes enable the Layout pattern (shared Navbar/BottomNav); PrivateRoute HOC guards protected pages |
| Styling | Tailwind CSS v3 | Utility-first with built-in dark mode (`class` strategy) and responsive prefixes; zero unused CSS in production |
| Animations | Framer Motion v12 | Declarative spring physics, `AnimatePresence` for exit animations, and `useMotionValue` for 60fps cursor updates without React re-renders |
| Auth | Firebase Authentication | Handles JWT sessions, token refresh, Google OAuth, and email/password — no custom backend needed |
| Database | Cloud Firestore | Real-time `onSnapshot` listeners, cursor-based pagination with `startAfter`, and flexible NoSQL schema |
| State Management | React Context API | Lightweight global state for auth (`AuthContext`) and toasts (`ToastContext`); local state via `useState` + `onSnapshot` |
| Icons | lucide-react + react-icons | lucide-react is individually tree-shaken per icon; only used icons are bundled |
| Date Handling | date-fns v4 | Tree-shakeable imports (~2KB per function vs Moment.js's 67KB full bundle) |
| Calendar | react-calendar | Fully controlled date picker for appointment booking |
| Charts | Pure SVG | Custom `DonutChart` + `BarChart` in SVG — saves ~80KB vs Chart.js or Recharts |
| Deployment | Vercel | Zero-config Vite deployment, global CDN, and automatic CI/CD on every `git push` |

## Firestore Collections

| Collection | Key Fields |
|-----------|-----------|
| `patients` | uid, firstName, lastName, email, bloodGroup, allergies, conditions, medications, height, weight, emergencyContact |
| `doctors` | uid, firstName, lastName, specialty, experience, licenseNumber, verified, avgRating, totalRatings, availability |
| `appointments` | patientId, doctorId, date, timeSlot, status, rating, patientName, doctorName |
| `notifications` | userId, message, type, appointmentId, read, createdAt |
| `reviews` | doctorId, patientId, rating, comment, patientName, createdAt |
| `bmiHistory` | userId, bmi, category, height, weight, unit, recordedAt |

## Project Structure

```
src/
├── about/              # About page with tech stack and architecture docs
├── appointments/       # Patient appointment management
├── bmi-tracker/        # BMI calculator, meal planner, medication tracker
├── components/         # Shared: Navbar, BottomNav, CustomCursor, Toast...
├── doc-dashboard/      # Doctor dashboard, availability setter, patient sidebar
├── faq/                # Help center with searchable FAQ accordion
├── login/ signup/      # Auth pages (email + Google OAuth)
├── medical-records/    # Patient health records form
├── patient-dashboard/  # Patient home dashboard with analytics charts
├── reviews/            # Review and rating system
├── search/             # Doctor search (search.jsx) + doctor profile (view.jsx)
├── settings/           # User settings (theme, notifications, account)
├── App.jsx             # Root: routes, AnimatedRoutes, home page
├── AuthContext.jsx      # Firebase auth context provider
└── main.jsx            # Entry point with CustomCursor + ToastProvider
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- A Firebase project with Firestore and Authentication enabled

### 1. Clone and Install

```bash
git clone https://github.com/1754riya/Jeevan_Chakra.git
cd Jeevan_Chakra/MediChain-main
npm install
```

> Note: the repository name/URL above is a holdover from before the CareFlow rebrand.

### 2. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com) and create a new project
2. Enable **Authentication** → Sign-in methods → turn on **Email/Password** and **Google**
3. Enable **Firestore Database** → Start in test mode
4. Go to **Project Settings** → Your apps → Add a Web app → copy the config

### 3. Environment Variables

Create a `.env.local` file in the `MediChain-main/` directory:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

> **Note:** `.env.local` is git-ignored. Never commit your Firebase credentials.

### 4. Run Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 5. Build for Production

```bash
npm run build       # outputs to dist/
npm run preview     # preview the production build locally
```

## Key Pages

| Route | Description |
|-------|-------------|
| `/` | Home — hero, stats, specialties, features, testimonials |
| `/search` | Find doctors with filters and real-time pagination |
| `/search/view?docid=...` | Doctor profile with booking calendar |
| `/appointments` | Patient appointment management |
| `/bmi-tracker` | Health tracker: BMI, meals, medications, history |
| `/medical-records` | Patient health records |
| `/dashboard` | Doctor dashboard |
| `/about` | Platform architecture and tech stack |
| `/faq` | Searchable FAQ |

## Responsive Design

- Tested at 320px, 375px, 425px, 768px, 1024px, 1280px+
- Bottom navigation on mobile (`md:hidden`)
- Touch targets ≥ 44×44px throughout
- `overflow-x: hidden` on html/body; safe area insets for iOS
- React Calendar fully overridden for mobile viewport fit
- Sticky "Book Appointment" CTA on doctor profile for mobile

## Team

| Name | GitHub |
|------|--------|
| Riya Mehta | [@1754riya](https://github.com/1754riya) |
| Pranav Chaturvedi | [@pranavchaturvedi](https://github.com/pranavchaturvedi) |

## License

MIT
