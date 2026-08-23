function detailsHtml({ patientName, doctorName, doctorSpecialty, date, timeSlot, symptoms, symptomDuration, severity, additionalInfo }) {
  const rows = [
    ['Patient', patientName],
    ['Doctor', doctorSpecialty ? `Dr. ${doctorName} (${doctorSpecialty})` : `Dr. ${doctorName}`],
    ['Date', date],
    ['Time', timeSlot],
    ['Symptoms', symptoms],
    ['Duration', symptomDuration],
    ['Severity', severity],
    ['Additional Info', additionalInfo],
  ].filter(([, value]) => value);

  return `<table style="border-collapse:collapse;font-family:sans-serif;font-size:14px;">
    ${rows.map(([label, value]) => `
      <tr>
        <td style="padding:4px 12px 4px 0;color:#6b7280;white-space:nowrap;">${label}</td>
        <td style="padding:4px 0;color:#111827;">${value}</td>
      </tr>`).join('')}
  </table>`;
}

export function patientConfirmationEmail(data) {
  return {
    subject: `Appointment Confirmed — ${data.date} at ${data.timeSlot}`,
    html: `<h2 style="font-family:sans-serif;">Your appointment is confirmed</h2>${detailsHtml(data)}`,
  };
}

export function doctorNotificationEmail(data) {
  return {
    subject: `New Appointment — ${data.patientName} on ${data.date} at ${data.timeSlot}`,
    html: `<h2 style="font-family:sans-serif;">New appointment booked</h2>${detailsHtml(data)}`,
  };
}

export function patientReminderEmail(data) {
  return {
    subject: `Reminder: Appointment Tomorrow — ${data.date} at ${data.timeSlot}`,
    html: `<h2 style="font-family:sans-serif;">This is a reminder of your upcoming appointment</h2>${detailsHtml(data)}`,
  };
}

export function doctorReminderEmail(data) {
  return {
    subject: `Reminder: Appointment Tomorrow — ${data.patientName} on ${data.date} at ${data.timeSlot}`,
    html: `<h2 style="font-family:sans-serif;">Reminder of your upcoming appointment</h2>${detailsHtml(data)}`,
  };
}

export function patientCancellationEmail(data) {
  return {
    subject: `Appointment Cancelled — ${data.date} at ${data.timeSlot}`,
    html: `<h2 style="font-family:sans-serif;">Your appointment has been cancelled</h2>${detailsHtml(data)}`,
  };
}

export function doctorCancellationEmail(data) {
  return {
    subject: `Appointment Cancelled — ${data.patientName} on ${data.date} at ${data.timeSlot}`,
    html: `<h2 style="font-family:sans-serif;">An appointment has been cancelled</h2>${detailsHtml(data)}`,
  };
}
