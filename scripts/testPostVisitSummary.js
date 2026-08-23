/**
 * Exercises the REAL, unmodified api/post-visit-summary.js handler against
 * the same in-memory Firestore fake used by testBookingConcurrency.js (see
 * scripts/test-support/), covering both a successful and a failed Gemini
 * response. Real GEMINI_API_KEY is read from .env directly (not via
 * --env-file) so the failure case can run first, before any key is present
 * in process.env — getClient() in api/lib/gemini.js only caches a client
 * after a successful call, so ordering failure-then-success in one process
 * is safe and avoids needing two separate runs.
 *
 * Run with:  node scripts/testPostVisitSummary.js
 */
import { register } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';

register('./test-support/firebaseAdminLoader.mjs', import.meta.url);

const { __fakeDb, __reset } = await import('./test-support/fakeFirebaseAdmin.mjs');
const { default: handler } = await import('../api/post-visit-summary.js');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✔ ${name}`);
    passed++;
  } catch (err) {
    console.error(`✘ ${name}`);
    console.error(err);
    failed++;
  }
}

function makeToken(payload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

function makeReq({ uid, body }) {
  return {
    method: 'POST',
    headers: { authorization: `Bearer ${makeToken({ uid })}` },
    body,
  };
}

function makeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; },
  };
}

async function seedAppointment(id, data) {
  await __fakeDb.collection('appointments').doc(id).set({
    doctorId: 'doc-1',
    patientId: 'patient-1',
    doctorName: 'Test Doctor',
    patientName: 'Test Patient',
    date: new Date(),
    timeSlot: '9:00 AM',
    status: 'completed',
    visitNotes: 'Patient has mild seasonal allergy symptoms: runny nose, sneezing, itchy eyes for 2 days. No fever.',
    prescription: [
      { medicine: 'Paracetamol 500mg', dosage: '1 tablet', frequency: 'Twice a day', duration: '3 days', instructions: 'Take after meals' },
      { medicine: 'Cetirizine 10mg', dosage: '1 tablet', frequency: 'Once at night', duration: '5 days', instructions: 'Take before sleeping' },
    ],
    followUpInstructions: 'Return in 1 week if symptoms persist or worsen.',
    ...data,
  });
}

function readEnvKey(name) {
  const content = fs.readFileSync('.env', 'utf8');
  const line = content.split(/\r?\n/).find(l => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim() : undefined;
}

/* ── 1. Only the treating doctor can trigger this ── */
await test('authorization: a caller who is not the treating doctor gets 403', async () => {
  __reset();
  await seedAppointment('appt-auth');
  const res = makeRes();
  await handler(makeReq({ uid: 'someone-else', body: { appointmentId: 'appt-auth' } }), res);
  assert.equal(res.statusCode, 403, JSON.stringify(res.body));
});

/* ── 2. Failed Gemini response (no API key configured) ── */
await test('failed Gemini response: appointment keeps no postVisitSummary, endpoint still responds success', async () => {
  delete process.env.GEMINI_API_KEY;
  __reset();
  await seedAppointment('appt-fail');

  const res = makeRes();
  await handler(makeReq({ uid: 'doc-1', body: { appointmentId: 'appt-fail' } }), res);

  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.success, true);
  assert.equal(res.body.postVisitSummary, null);

  // The appointment itself is unaffected — still completed, notes/prescription intact.
  const stored = __fakeDb.read('appointments', 'appt-fail');
  assert.equal(stored.status, 'completed');
  assert.equal(stored.visitNotes.includes('allergy'), true);
  assert.equal(stored.prescription.length, 2);
  assert.equal('postVisitSummary' in stored, false);
});

/* ── 3. Successful Gemini response ── */
await test('successful Gemini response: postVisitSummary is generated and merged without touching other fields', async () => {
  process.env.GEMINI_API_KEY = readEnvKey('GEMINI_API_KEY');
  if (!process.env.GEMINI_API_KEY) {
    console.log('  (skipped — no real GEMINI_API_KEY in .env)');
    return;
  }

  __reset();
  await seedAppointment('appt-success');

  const res = makeRes();
  await handler(makeReq({ uid: 'doc-1', body: { appointmentId: 'appt-success' } }), res);

  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.success, true);
  assert.ok(res.body.postVisitSummary, 'expected a postVisitSummary in the response');
  assert.ok(res.body.postVisitSummary.whatDoctorNoted, 'missing whatDoctorNoted');
  assert.ok(res.body.postVisitSummary.medicationSchedule, 'missing medicationSchedule');
  assert.ok(res.body.postVisitSummary.followUpSteps, 'missing followUpSteps');

  // Merged onto the SAME doc, alongside (not replacing) the existing fields.
  const stored = __fakeDb.read('appointments', 'appt-success');
  assert.equal(stored.status, 'completed');
  assert.equal(stored.doctorId, 'doc-1');
  assert.equal(stored.prescription.length, 2);
  assert.deepEqual(stored.postVisitSummary, res.body.postVisitSummary);

  console.log('  Generated summary:', JSON.stringify(stored.postVisitSummary, null, 2));
});

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
