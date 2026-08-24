import { GoogleGenAI, Type } from '@google/genai';

let cachedClient = null;

function getClient() {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('AI service is not configured: missing GEMINI_API_KEY.');
  cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
}

const SUMMARY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    urgency: {
      type: Type.STRING,
      enum: ['Low', 'Medium', 'High'],
      description: "Clinical urgency of the patient's reported symptoms.",
    },
    chiefComplaint: {
      type: Type.STRING,
      description: "One concise sentence summarizing the patient's main complaint.",
    },
    suggestedQuestions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Exactly 3 short questions the doctor could ask the patient during the visit.',
    },
  },
  required: ['urgency', 'chiefComplaint', 'suggestedQuestions'],
};

/**
 * Summarizes a patient's pre-visit symptom form into a structured brief for
 * the doctor (urgency, chief complaint, 3 suggested questions), via Gemini.
 *
 * Best-effort only: throws on any failure (missing key, network error,
 * malformed response). Callers must catch this and must never let it block
 * appointment creation — see api/book-appointment.js.
 */
export async function generateSymptomSummary({ symptoms, symptomDuration, severity, additionalInfo }) {
  const prompt = [
    'A patient submitted this pre-visit symptom form ahead of a doctor appointment.',
    'Summarize it for the doctor.',
    '',
    `Symptoms: ${symptoms || 'Not specified'}`,
    `Duration: ${symptomDuration || 'Not specified'}`,
    `Patient-reported severity: ${severity || 'Not specified'}`,
    `Additional information: ${additionalInfo || 'None'}`,
  ].join('\n');

  const response = await getClient().models.generateContent({
    model: 'gemini-3.6-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: SUMMARY_SCHEMA,
    },
  });

  const parsed = JSON.parse(response.text);
  if (!parsed.urgency || !parsed.chiefComplaint || !Array.isArray(parsed.suggestedQuestions)) {
    throw new Error('Malformed AI summary response');
  }

  return {
    urgency: parsed.urgency,
    chiefComplaint: parsed.chiefComplaint,
    suggestedQuestions: parsed.suggestedQuestions.slice(0, 3),
  };
}

const POST_VISIT_SUMMARY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    whatDoctorNoted: {
      type: Type.STRING,
      description: "Plain-language summary of what the doctor noted during the visit, for the patient to read.",
    },
    medicationSchedule: {
      type: Type.STRING,
      description: 'Plain-language description of the prescribed medicines and how/when to take them.',
    },
    followUpSteps: {
      type: Type.STRING,
      description: 'Plain-language follow-up instructions for the patient.',
    },
  },
  required: ['whatDoctorNoted', 'medicationSchedule', 'followUpSteps'],
};

function formatPrescriptionForPrompt(prescription) {
  if (!Array.isArray(prescription) || prescription.length === 0) return 'None prescribed.';
  return prescription
    .map(m => `- ${m.medicine}: ${[m.dosage, m.frequency, m.duration].filter(Boolean).join(', ')}${m.instructions ? ` (${m.instructions})` : ''}`)
    .join('\n');
}

/**
 * Converts a completed visit's clinical notes/prescription/follow-up into a
 * simple, patient-friendly post-visit summary, via Gemini.
 *
 * Best-effort only: throws on any failure (missing key, network error,
 * malformed response). Callers must catch this and must never let it block
 * appointment completion — see api/post-visit-summary.js.
 */
export async function generatePostVisitSummary({ visitNotes, prescription, followUpInstructions }) {
  const prompt = [
    'Convert these clinical notes into a simple, patient-friendly summary.',
    'Include what the doctor noted, the medication schedule, and follow-up steps.',
    "Do not add information that is not present in the doctor's notes or prescription.",
    '',
    `Clinical Notes: ${visitNotes || 'None'}`,
    `Prescription: ${formatPrescriptionForPrompt(prescription)}`,
    `Follow-up Instructions: ${followUpInstructions || 'None'}`,
  ].join('\n');

  const response = await getClient().models.generateContent({
    model: 'gemini-3.6-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: POST_VISIT_SUMMARY_SCHEMA,
    },
  });

  const parsed = JSON.parse(response.text);
  if (!parsed.whatDoctorNoted || !parsed.medicationSchedule || !parsed.followUpSteps) {
    throw new Error('Malformed AI post-visit summary response');
  }

  return {
    whatDoctorNoted: parsed.whatDoctorNoted,
    medicationSchedule: parsed.medicationSchedule,
    followUpSteps: parsed.followUpSteps,
  };
}
