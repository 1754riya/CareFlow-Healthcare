/**
 * Node module-customization hook (registered via node:module's register()
 * in the test scripts under scripts/) that redirects imports of
 * api/lib/firebaseAdmin.js, api/lib/googleCalendar.js, and api/lib/mailer.js
 * to their in-memory fakes. This lets tests import and invoke REAL,
 * unmodified api/*.js handlers while their internal Firestore/auth/Calendar/
 * email calls transparently hit fakes instead of requiring a live Firebase
 * project, the live Google Calendar API, or a live SMTP server.
 *
 * Matches on the specifier's basename rather than a fixed relative path:
 * files directly under api/ import firebaseAdmin.js as './lib/firebaseAdmin.js',
 * but files already inside api/lib/ (e.g. appointmentAccess.js) import it as
 * plain './firebaseAdmin.js' — both must resolve to the fake.
 */
const REDIRECTS = {
  'firebaseAdmin.js': './fakeFirebaseAdmin.mjs',
  'googleCalendar.js': './fakeGoogleCalendar.mjs',
  'mailer.js': './fakeMailer.mjs',
};

export async function resolve(specifier, context, nextResolve) {
  for (const [suffix, fake] of Object.entries(REDIRECTS)) {
    if (specifier.endsWith(suffix)) {
      return { url: new URL(fake, import.meta.url).href, shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}
