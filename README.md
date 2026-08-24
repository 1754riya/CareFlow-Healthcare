# CareFlow — Healthcare Appointment & Follow-up Manager

A full-stack healthcare platform connecting patients with doctors. Built with React 18, Firebase, Vercel Serverless Functions, Google Calendar, and Gemini AI.

![CareFlow](public/logo.png)

## Features

### Patient
- **Find Doctors** — Search by name, specialty, or location with real-time Firestore pagination
- **Book Appointments** — Real-time slot availability, transactional double-booking protection, and a short-lived slot hold while filling out the booking form
- **Medical Records** — Allergies, medications, conditions, family history, vitals, and emergency contacts
- **Health Tracker** — BMI calculator, meal planner, medication reminders, and progress history
- **Appointments Dashboard** — View upcoming, past, and cancelled appointments; reschedule or cancel
- **AI Pre-Visit Summary** — Symptoms submitted at booking are summarized for the doctor via Gemini
- **AI Post-Visit Summary** — Clinical notes/prescription are turned into a plain-language summary after the visit
- **Medication Reminders** — Automatic daily reminders generated from a doctor's prescription
- **Google Calendar Sync** — Appointments can be added to the patient's Google Calendar automatically
- **Real-Time Notifications** — Instant updates for appointment confirmations, completions, and reviews

### Doctor
- **Doctor Dashboard** — View upcoming appointments, manage availability, and see patient stats
- **Set Availability / Leave Days** — Define working hours and slot duration; blocking a day off automatically cancels (and notifies/emails) any already-booked appointments on it
- **Consultation Notes & Prescription** — Record visit notes, prescriptions, and follow-up instructions
- **Patient Reviews** — Receive ratings and reviews after completed appointments
- **Verification Badge** — License number submission with verified badge on profile

### Admin
- **Admin Dashboard** — Restricted to accounts with an `admins/{uid}` Firestore document
- **Doctor Management** — Create doctor accounts, edit profiles, set specialization/availability/slot duration/leave dates, activate/deactivate

### Platform
- **Email Notifications** — Booking confirmations, cancellations, and next-day reminders, with a Firestore-backed retry queue for failed sends
- **Dark Mode** — Full dark mode support across all pages
- **Fully Responsive** — Mobile-first design with bottom navigation

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite 6, React Router v7, Tailwind CSS v3, Framer Motion |
| Backend | Vercel Serverless Functions (`api/`), Node.js, `firebase-admin` |
| Auth | Firebase Authentication (email/password + Google OAuth) |
| Database | Cloud Firestore |
| AI | Google Gemini (`@google/genai`) |
| Calendar | Google Calendar API (`googleapis`) + Google Identity Services |
| Email | Nodemailer (SMTP) |
| Scheduling | Vercel Cron Jobs |
| Deployment | Vercel |

## Project Structure

```
├── api/                 # Vercel Serverless Functions (backend)
│   ├── admin/            # Admin-only doctor management endpoints
│   ├── auth/google/       # Google Calendar OAuth exchange/status/disconnect
│   ├── cron/              # Scheduled jobs (reminders, email retry)
│   └── lib/               # Shared server-side helpers (Firebase Admin, Gemini, mailer, Calendar...)
├── src/
│   ├── admin-dashboard/  # Admin Dashboard UI
│   ├── appointments/     # Patient appointment management
│   ├── bmi-tracker/      # BMI calculator, meal planner, medication tracker
│   ├── components/       # Shared UI: Navbar, BottomNav, Toast, ConnectGoogleCalendar...
│   ├── doc-dashboard/    # Doctor dashboard, availability, consultation form
│   ├── login/ signup/    # Auth pages (email + Google OAuth)
│   ├── medical-records/  # Patient health records form
│   ├── search/           # Doctor search + doctor profile/booking
│   ├── settings/         # User settings, incl. Google Calendar connect
│   ├── utils/             # Client-side helpers (booking, slot generation, calendar sync...)
│   └── firebase/config.js # Firebase client SDK initialization
├── scripts/              # Node test suites + admin CLI (see "Build and test commands")
├── doctor.json            # Seed dataset of ~17,600 doctor records
└── vercel.json             # Rewrites + Cron job schedule
```

---

## 1. Setup Guide

### Prerequisites

- Node.js 18+ and npm 9+
- A [Firebase](https://console.firebase.google.com) project with **Authentication** (Email/Password + Google) and **Firestore Database** enabled
- A [Google Cloud](https://console.cloud.google.com) project with the Calendar API enabled (see [Google Calendar Setup](#6-google-calendar-setup)) — optional, only needed for Calendar sync
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey) — optional, only needed for AI summaries
- An SMTP-capable email account (e.g. Gmail with an App Password) — optional, only needed for email notifications
- The [Vercel CLI](https://vercel.com/docs/cli) (`npm i -g vercel`) for local API-route development and deployment

### Installation

```bash
git clone https://github.com/1754riya/CareFlow-Healthcare.git
cd CareFlow-Healthcare
npm install
```

### Environment setup

1. Copy the template: `cp .env.example .env.local` (frontend `VITE_*` vars) and `cp .env.example .env` (backend vars, used by `vercel dev`/Vercel).
2. Fill in the Firebase web app config from **Firebase Console → Project Settings → Your apps**.
3. Fill in the remaining variables as needed for the features you want to run locally — see [.env.example](#2-envexample) below for what each one is for, and [Google Calendar Setup](#6-google-calendar-setup) for the Calendar-specific ones.
4. Never commit `.env`, `.env.local`, or any service-account JSON file — `.gitignore` already excludes them.

### Local development

The frontend can run standalone with Vite, but the `api/` serverless functions require the Vercel CLI:

```bash
npm run dev            # Vite only — frontend at http://localhost:5173, api/ routes are NOT available
vercel dev             # Frontend + api/ routes together (recommended), via the Vercel CLI
```

`vercel dev` reads environment variables from `.env` (and prompts to link the project to Vercel on first run).

### Build and test commands

```bash
npm run build       # production build -> dist/
npm run preview      # preview the production build locally
npm run lint          # ESLint

# Node-based test suites (scripts/) — each exercises the real, unmodified
# api/ handlers against an in-memory Firestore/Auth/Calendar/Mailer fake,
# no live Firebase/Google/SMTP backend required:
node scripts/testBookingConcurrency.js
node scripts/testSlotHold.js
node scripts/testDoctorLeave.js
node scripts/testAdminDashboard.js
node scripts/testGoogleCalendar.mjs
node scripts/testEmailSystem.js
node scripts/testMedicationReminders.js
node scripts/testPostVisitSummary.js
node scripts/testConsultationPayload.js
node scripts/testSlotGeneration.js

# One-time admin CLI (requires FIREBASE_SERVICE_ACCOUNT_KEY):
node scripts/grantAdmin.js someone@example.com [password]
```

---

## 2. .env.example

[.env.example](.env.example) at the project root lists every environment variable CareFlow's code reads, grouped by feature, with placeholder (empty) values only — no real keys, passwords, or secrets. Copy it to `.env.local` and `.env` and fill in real values locally; never commit the filled-in files.

| Variable | Required for | Client or server |
|---|---|---|
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MEASUREMENT_ID` | Firebase Auth + Firestore (core app) | Client |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Every `/api` route (Admin SDK) | Server |
| `EMAIL_USER`, `EMAIL_PASSWORD` | Sending emails | Server |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_FROM`, `EMAIL_FROM_NAME` | Email — optional overrides | Server |
| `VITE_GOOGLE_OAUTH_CLIENT_ID` | Google Calendar connect popup | Client |
| `GOOGLE_OAUTH_CLIENT_ID` | Google Calendar token exchange (same value as above) | Server |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google Calendar token exchange | Server — **never** `VITE_`-prefixed |
| `GEMINI_API_KEY` | AI pre-/post-visit summaries | Server |
| `CRON_SECRET` | Authenticating Vercel Cron requests — optional | Server |

---

## 3. API Documentation

All endpoints live under `api/` as Vercel Serverless Functions. Unless noted, endpoints require a Firebase ID token in `Authorization: Bearer <token>`, verified via `requireAuthenticatedUser` (`api/lib/firebaseAdmin.js`).

### Booking & Scheduling

| Method | Endpoint | Purpose | Auth / role | Request body | Response |
|---|---|---|---|---|---|
| POST | `/api/book-appointment` | Authoritative appointment booking — re-validates slot availability and any active hold inside a Firestore transaction, then creates the appointment. Best-effort AI pre-visit summary is attached afterward. | Any authenticated user | `{ doctorId, dateKey, timeSlot, symptoms?, symptomDuration?, severity?, additionalInfo? }` | `200 { success, id }` · `409` slot unavailable/held · `404` doctor not found · `403` doctor inactive |
| POST | `/api/hold-slot` | Places a 5-minute hold on a slot when the patient clicks "Continue", so it stays reserved while they fill out the symptom form. | Any authenticated user | `{ doctorId, dateKey, timeSlot }` | `200 { success, expiresAt }` · `409` held by someone else / no longer available |
| POST | `/api/release-slot-hold` | Releases the caller's own hold early (e.g. they navigate back). Only deletes a hold owned by the caller. | Any authenticated user | `{ doctorId, dateKey, timeSlot }` | `200 { success }` |
| POST | `/api/reschedule-appointment` | Moves an existing appointment to a new date/time, re-running the same transactional conflict check (excluding the appointment's own current slot). | Patient or doctor on the appointment | `{ appointmentId, dateKey, timeSlot }` | `200 { success }` · `409` new slot unavailable · `403` not authorized · `400` cancelled/completed appointment |

### Google Calendar Sync

| Method | Endpoint | Purpose | Auth / role | Request body | Response |
|---|---|---|---|---|---|
| POST | `/api/create-calendar-events` | Creates Calendar events for the patient and/or doctor on an appointment, if they've connected Calendar. Idempotent — skips a role that already has an event. | Patient or doctor on the appointment | `{ appointmentId }` | `200 { success, calendarEventIds }` |
| POST | `/api/update-calendar-events` | Syncs existing Calendar events to the appointment's current date/time (used after reschedule); creates one if it doesn't exist yet. | Patient or doctor on the appointment | `{ appointmentId }` | `200 { success, calendarEventIds }` |
| POST | `/api/delete-calendar-events` | Deletes both parties' Calendar events (e.g. on cancellation). Treats an already-deleted event as success. | Patient or doctor on the appointment | `{ appointmentId }` | `200 { success }` |
| POST | `/api/auth/google/exchange` | Exchanges the one-time Google OAuth authorization code (from the consent popup) for tokens and stores the refresh token. | Any authenticated user | `{ code }` | `200 { success }` · `502` exchange failed |
| GET | `/api/auth/google/status` | Reports whether the caller has connected Google Calendar. | Any authenticated user | — | `200 { connected }` |
| POST | `/api/auth/google/disconnect` | Removes the caller's stored Calendar tokens. | Any authenticated user | — | `200 { success }` |

### AI Summaries & Medication Reminders

| Method | Endpoint | Purpose | Auth / role | Request body | Response |
|---|---|---|---|---|---|
| POST | `/api/post-visit-summary` | Converts a completed visit's clinical notes/prescription/follow-up into a patient-friendly summary via Gemini, saved onto the appointment doc. | The treating doctor | `{ appointmentId }` | `200 { success, postVisitSummary }` |
| POST | `/api/create-medication-reminders` | Builds `medicationReminders` schedule docs from a completed appointment's prescription (one per medicine with a parseable frequency/duration). Idempotent. | The treating doctor | `{ appointmentId }` | `200 { success, remindersCreated, skipped }` |

### Email

| Method | Endpoint | Purpose | Auth / role | Request body | Response |
|---|---|---|---|---|---|
| POST | `/api/send-appointment-confirmation` | Sends a booking confirmation email to the patient (always) and doctor (if an email is on file). | None | `{ patientName, patientEmail, doctorName, doctorEmail?, date, timeSlot, ... }` | `200/502 { success, results }` |
| POST | `/api/send-cancellation-email` | Sends a cancellation email to the patient and doctor for an already-cancelled appointment. Failed sends are queued for retry rather than failing the request. | Patient or doctor on the appointment | `{ appointmentId }` | `200 { success }` |

### Admin

| Method | Endpoint | Purpose | Auth / role | Request body | Response |
|---|---|---|---|---|---|
| POST | `/api/admin/create-doctor` | Provisions a new doctor: Firebase Auth account + `doctors/{uid}` Firestore document. | Admin (`admins/{uid}` doc must exist) | `{ email, password, firstName, lastName, specialty, location?, experience?, licenseNumber?, clinicName?, about?, fee? }` | `200 { success, uid }` · `409` email in use |
| POST | `/api/admin/update-doctor` | Single generic endpoint for every doctor mutation: profile fields, activate/deactivate, availability, slot duration, and leave dates. Newly-added leave dates automatically cancel (and notify) already-booked appointments on that day. | Admin | `{ doctorId, updates: { <allowed fields> } }` | `200 { success, leaveCancellations? }` |

### Cron Jobs (Vercel Cron — see [vercel.json](vercel.json))

| Method | Endpoint | Purpose | Auth / role | Schedule |
|---|---|---|---|---|
| GET | `/api/cron/send-medication-reminders` | Sends a `notifications` doc for every medication dose due today; marks expired schedules `completed`. | `CRON_SECRET` bearer token, if configured | Daily, 08:00 UTC |
| GET | `/api/cron/send-appointment-reminders` | Emails patient + doctor for every confirmed appointment happening tomorrow; sets `reminderSent`. | `CRON_SECRET` bearer token, if configured | Daily, 09:00 UTC |
| GET | `/api/cron/retry-failed-emails` | Retries every `emailQueue` doc with `status: 'pending'`; marks `sent` or, after `MAX_EMAIL_ATTEMPTS` (5), `failed`. | `CRON_SECRET` bearer token, if configured | Daily, 10:00 UTC |

---

## 4. Database Schema

Cloud Firestore, accessed both from the client SDK (with security rules) and via the Admin SDK server-side (bypassing rules). Fields below are the ones actually written by the code — optional/best-effort fields are marked as such.

### `patients/{uid}`
Written at signup (`src/signup/signup.jsx`); medical-record fields added later (`src/medical-records/MedicalRecords.jsx`).
- `uid`, `firstName`, `lastName`, `email`, `role: 'patient'`, `createdAt`
- `photoURL` — Google sign-up only
- `bloodGroup`, `height`, `weight`, `allergies[]`, `chronicConditions[]`, `currentMedications[]`, `previousSurgeries`, `familyHistory`, `emergencyContactName`, `emergencyContactPhone`, `emergencyContactRelation`, `updatedAt` — from Medical Records form

### `doctors/{uid}`
Written at self-signup, or fully provisioned by `api/admin/create-doctor.js`.
- `uid`, `firstName`, `lastName`, `name`, `email`, `role: 'doctor'`, `specialty`, `location`, `experience`, `licenseNumber`, `createdAt`
- `verified` — `false` at self-signup, `true` when admin-created
- `active`, `avgRating`, `totalRatings`, `availability` (map of weekday → time slots), `blockedDates[]` (leave days), `slotDuration` (minutes), `searchKeywords[]` (kept in sync with name/specialty), `clinicName`, `about`, `fee`, `image`
- `createdByAdmin` — admin-created doctors only

### `appointments/{id}`
Created by `api/book-appointment.js`; updated by reschedule, consultation, and calendar-sync flows.
- `doctorId`, `patientId`, `date`, `timeSlot`, `doctorName`, `doctorSpecialty`, `patientName`, `status` (`confirmed` | `completed` | `cancelled`), `createdAt`
- `symptoms`, `symptomDuration`, `severity`, `additionalInfo` — pre-visit form
- `aiSummary` (`{ urgency, chiefComplaint, suggestedQuestions[] }`) — best-effort, set after booking
- `visitNotes`, `prescription[]` (`{ medicine, dosage, frequency, duration, instructions }`), `followUpInstructions` — set by the doctor's consultation form
- `postVisitSummary` (`{ whatDoctorNoted, medicationSchedule, followUpSteps }`) — best-effort, set on completion
- `completedAt`, `rescheduledAt`, `updatedAt`
- `calendarEventIds` (`{ patient?, doctor? }`) — Google Calendar event IDs, if either party is connected
- `reminderSent` — set by the appointment-reminder cron

### `slotHolds/{doctorId_dateKey_timeSlot}`
Deterministic doc ID — at most one hold can ever exist per slot.
- `doctorId`, `dateKey`, `timeSlot`, `patientId`, `createdAt`, `expiresAt` (5 minutes after creation)

### `medicationReminders/{id}`
One doc per prescribed medicine with a parseable frequency and duration, created by `api/create-medication-reminders.js`.
- `appointmentId`, `patientId`, `doctorId`, `medicine`, `dosage`, `instructions`, `frequency`, `timesPerDay`, `duration`, `durationDays`, `startDate`, `endDate`, `status` (`active` | `completed`), `lastSentDate`, `createdAt`

### `emailQueue/{id}`
Written by `api/lib/emailQueue.js` when an email send fails; retried by the daily cron.
- `type`, `to`, `subject`, `html`, `appointmentId`, `recipientRole`, `status` (`pending` | `sent` | `failed`), `attempts`, `lastError`, `createdAt`, `sentAt`

### `notifications/{id}`
- `userId`, `message`, `type`, `appointmentId`, `read`, `createdAt`

### `googleCalendarTokens/{uid}`
One doc per user who has connected Google Calendar (`api/lib/googleCalendar.js`).
- `refreshToken`, `scope`, `connectedAt`, `updatedAt`

### `admins/{uid}`
Existence of a doc here (not a field on the user's own record) is what grants admin access — checked by `requireAdmin()` on every `/api/admin/*` route. No public signup path; only created via `scripts/grantAdmin.js`.
- `uid`, `email`, `role: 'admin'`, `createdAt`

---

## 5. LLM Prompts

Both prompts are built and called in `api/lib/gemini.js`, using the `gemini-3.6-flash` model with a structured `responseSchema` (JSON output). Both are best-effort: on any failure (missing API key, network error, malformed response) the caller catches the error and proceeds without the summary — booking and visit completion are never blocked by the AI call.

### AI pre-visit symptom summary
Called from `api/book-appointment.js` right after an appointment is created.

**Data sent:** the patient's pre-visit form — `symptoms`, `symptomDuration`, `severity`, `additionalInfo`.

**Prompt template:**
```
A patient submitted this pre-visit symptom form ahead of a doctor appointment.
Summarize it for the doctor.

Symptoms: {symptoms}
Duration: {symptomDuration}
Patient-reported severity: {severity}
Additional information: {additionalInfo}
```

**Output schema:** `{ urgency: 'Low'|'Medium'|'High', chiefComplaint: string, suggestedQuestions: string[3] }`

**Stored as:** `aiSummary` on the `appointments/{id}` doc, shown to the doctor on the Doctor Dashboard ("AI summary unavailable" if generation failed).

### AI post-visit patient-friendly summary
Called from `api/post-visit-summary.js` right after the doctor marks an appointment completed.

**Data sent:** the doctor's consultation notes — `visitNotes`, `prescription` (formatted as one line per medicine: `medicine: dosage, frequency, duration (instructions)`), `followUpInstructions`.

**Prompt template:**
```
Convert these clinical notes into a simple, patient-friendly summary.
Include what the doctor noted, the medication schedule, and follow-up steps.
Do not add information that is not present in the doctor's notes or prescription.

Clinical Notes: {visitNotes}
Prescription: {formatted prescription list}
Follow-up Instructions: {followUpInstructions}
```

**Output schema:** `{ whatDoctorNoted: string, medicationSchedule: string, followUpSteps: string }`

**Stored as:** `postVisitSummary` on the `appointments/{id}` doc, shown to the patient ("Post-visit summary unavailable" if generation failed).

---

## 6. Google Calendar Setup

CareFlow uses a popup-based OAuth flow (Google Identity Services `initCodeClient`) to let a patient or doctor connect their own Google Calendar; appointments are then created/updated/deleted as events on their calendar server-side (`api/lib/googleCalendar.js`).

### 1. Create a Google Cloud project
Go to the [Google Cloud Console](https://console.cloud.google.com) → create a new project (or select an existing one).

### 2. Enable the Google Calendar API
**APIs & Services → Library** → search **Google Calendar API** → **Enable**.

### 3. Configure the OAuth consent screen (Google Auth Platform)
**APIs & Services → OAuth consent screen** (Google Auth Platform):
- Choose **External** (or **Internal** if using a Google Workspace org)
- Fill in app name, support email, and developer contact email
- While in testing mode, add any Google accounts you'll test with under **Test users**

### 4. Add the required Calendar scope
Under **Data Access** (or **Scopes**), add:
```
https://www.googleapis.com/auth/calendar.events
```
This matches `CALENDAR_SCOPE` in `src/utils/googleCalendarAuth.js` — it grants event create/read/update/delete access without full account-wide Calendar access.

### 5. Create a Web application OAuth Client ID
**APIs & Services → Credentials → Create Credentials → OAuth client ID** → Application type **Web application**.

### 6. Configure Authorized JavaScript origins
Add every origin the app is served from — no path, no trailing slash:
- `http://localhost:5173` (Vite dev)
- Your local `vercel dev` origin, if different (e.g. `http://localhost:3000`)
- Your production Vercel domain (e.g. `https://your-project.vercel.app`)

No **Authorized redirect URI** is needed — the code exchange uses Google Identity Services' `ux_mode: 'popup'` (`postmessage` flow), not a server-side redirect.

### 7. Required environment variables
| Variable | Value | Where |
|---|---|---|
| `VITE_GOOGLE_OAUTH_CLIENT_ID` | The OAuth Client ID | Client (`.env.local` / Vercel) |
| `GOOGLE_OAUTH_CLIENT_ID` | The **same** Client ID | Server (`.env` / Vercel) |
| `GOOGLE_OAUTH_CLIENT_SECRET` | The Client Secret | Server only |

`GOOGLE_OAUTH_CLIENT_SECRET` must **never** be prefixed with `VITE_` and must never be referenced from any file under `src/` — Vite inlines every `VITE_`-prefixed variable into the client bundle, so anything with that prefix ships to the browser. It is read only in `api/lib/googleCalendar.js`, server-side.

### 8. Connecting Google Calendar from CareFlow
Once configured, a user connects from **Settings → Google Calendar** (or the doctor dashboard's equivalent panel, via `src/components/ConnectGoogleCalendar.jsx`):
1. Clicking **Connect** opens the Google consent popup requesting the Calendar scope.
2. The one-time authorization code is sent to `POST /api/auth/google/exchange`.
3. The server exchanges it for a refresh token and stores it in `googleCalendarTokens/{uid}`.
4. From then on, booking/rescheduling/cancelling an appointment for that user creates/updates/deletes a matching Calendar event automatically.
5. **Disconnect** calls `POST /api/auth/google/disconnect`, which deletes the stored token.

### 9. Local development and production configuration
- **Local:** set `VITE_GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` in `.env.local`/`.env`, run `vercel dev` (plain `vite dev` won't serve the `/api/auth/google/*` routes), and make sure your local origin is in the OAuth client's Authorized JavaScript origins.
- **Production:** set the same three variables in the Vercel project's Environment Variables, and add the deployed domain to Authorized JavaScript origins. Once out of testing mode, publish the OAuth consent screen so non-test-user accounts can connect.

---

## License

MIT
