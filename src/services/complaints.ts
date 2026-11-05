import type { Unsubscribe } from 'firebase/firestore';
import { auth, getDb } from '../lib/firebase';
import type { Complaint, ComplaintStatus } from '../types/complaint';

export async function subscribeToComplaints(onItems: (items: Complaint[]) => void, onError: (error: Error) => void): Promise<Unsubscribe> {
  if (!auth?.currentUser) throw new Error('Sign in with an admin account to review complaints.');
  const db = await getDb();
  const { collection, onSnapshot, orderBy, query } = await import('firebase/firestore');
  return onSnapshot(query(collection(db, 'complaints'), orderBy('createdAt', 'desc')),
    snapshot => onItems(snapshot.docs.map(item => ({ ...item.data(), id: item.id } as Complaint))),
    error => onError(error));
}

export async function updateComplaintReview(id: string, status: ComplaintStatus, note: string): Promise<void> {
  if (!auth?.currentUser) throw new Error('Sign in with an admin account to review complaints.');
  const cleanNote = note.trim();
  if ((status === 'Resolved' || status === 'Dismissed') && !cleanNote) throw new Error('An admin note is required to resolve or dismiss a report.');
  const db = await getDb();
  const { updateDoc, doc, serverTimestamp } = await import('firebase/firestore');
  await updateDoc(doc(db, 'complaints', id), { status, adminNote: cleanNote, reviewedAt: serverTimestamp(), updatedAt: serverTimestamp() });
}
