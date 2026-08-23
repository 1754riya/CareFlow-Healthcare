/**
 * Tests for src/utils/prescription.js — the pure function ConsultationForm.jsx
 * uses to shape the doctor's notes/prescription/follow-up into the payload
 * persisted onto the appointment doc. Run with:
 *
 *   node scripts/testConsultationPayload.js
 */
import assert from 'node:assert/strict';
import { buildConsultationPayload, emptyMedicine } from '../src/utils/prescription.js';

let passed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✔ ${name}`);
    passed++;
  } catch (err) {
    console.error(`✘ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

test('multiple medicines are all preserved, in order, with trimmed fields', () => {
  const payload = buildConsultationPayload({
    notes: '  Patient presents with fever and cold symptoms.  ',
    medicines: [
      { medicine: '  Paracetamol 500mg  ', dosage: ' 1 tablet ', frequency: 'Twice a day', duration: '3 days', instructions: 'Take after meals' },
      { medicine: 'Cetirizine 10mg', dosage: '1 tablet', frequency: 'Once at night', duration: '5 days', instructions: '  Take before sleeping  ' },
    ],
    followUp: 'Return in 1 week if symptoms persist.',
  });

  assert.equal(payload.visitNotes, 'Patient presents with fever and cold symptoms.');
  assert.equal(payload.followUpInstructions, 'Return in 1 week if symptoms persist.');
  assert.equal(payload.prescription.length, 2);
  assert.deepEqual(payload.prescription[0], {
    medicine: 'Paracetamol 500mg', dosage: '1 tablet', frequency: 'Twice a day', duration: '3 days', instructions: 'Take after meals',
  });
  assert.deepEqual(payload.prescription[1], {
    medicine: 'Cetirizine 10mg', dosage: '1 tablet', frequency: 'Once at night', duration: '5 days', instructions: 'Take before sleeping',
  });
});

test('a medicine row left blank (unused "Add Medicine" row) is dropped', () => {
  const payload = buildConsultationPayload({
    notes: 'Notes',
    medicines: [
      { medicine: 'Paracetamol 500mg', dosage: '1 tablet', frequency: 'Twice a day', duration: '3 days', instructions: 'Take after meals' },
      emptyMedicine(),
    ],
    followUp: '',
  });
  assert.equal(payload.prescription.length, 1);
  assert.equal(payload.prescription[0].medicine, 'Paracetamol 500mg');
});

test('a medicine row with only whitespace in the name is dropped', () => {
  const payload = buildConsultationPayload({
    notes: '',
    medicines: [{ medicine: '   ', dosage: '1 tablet', frequency: '', duration: '', instructions: '' }],
    followUp: '',
  });
  assert.equal(payload.prescription.length, 0);
});

test('empty notes/follow-up and no medicines produce an empty-but-valid payload', () => {
  const payload = buildConsultationPayload({ notes: '', medicines: [], followUp: '' });
  assert.deepEqual(payload, { visitNotes: '', prescription: [], followUpInstructions: '' });
});

test('missing fields on a medicine row do not throw, and are treated as empty', () => {
  const payload = buildConsultationPayload({
    notes: '',
    medicines: [{ medicine: 'Ibuprofen' }],
    followUp: '',
  });
  assert.deepEqual(payload.prescription[0], {
    medicine: 'Ibuprofen', dosage: '', frequency: '', duration: '', instructions: '',
  });
});

console.log(`\n${passed} test(s) passed.`);
