import { collection, addDoc } from '@firebase/firestore';
import { db } from '../firebase/config';

export async function createNotification({ userId, message, type, appointmentId = null }) {
  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      message,
      type,
      appointmentId,
      read: false,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
}
