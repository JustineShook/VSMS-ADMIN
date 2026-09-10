// TEMPORARY STATIC MOCK DATA for UI visualization only. These are fictional
// records, to be replaced by authorized Firestore services in a future task.
export const stats = [
  { label: 'Total Users', value: '2,846', detail: '+128 this month', trend: '+4.7%' },
  { label: 'Pending Verifications', value: '18', detail: 'Sample only — live queue below', trend: 'Mock metric' },
  { label: 'Active Providers', value: '164', detail: 'Across all service categories', trend: '+8.6%' },
  { label: 'Total Bookings', value: '1,392', detail: '+96 this month', trend: '+7.4%' },
];
export type BookingStatus = 'Pending' | 'Accepted' | 'Vehicle Arrived' | 'Diagnosing' | 'Repairing' | 'Completed' | 'Rejected';
export const bookings: { id: string; customer: string; provider: string; service: string; status: BookingStatus; time: string }[] = [
  { id: 'VR-01042', customer: 'Miguel Santos', provider: 'RoadReady Auto Care', service: 'Auto shop', status: 'Repairing', time: '10:42 AM' },
  { id: 'VR-01041', customer: 'Isabel Reyes', provider: 'Metro Rescue Towing', service: 'Towing', status: 'Accepted', time: '10:35 AM' },
  { id: 'VR-01040', customer: 'Carlo Mendoza', provider: 'Alex Mobile Mechanic', service: 'Onsite mechanic', status: 'Pending', time: '10:18 AM' },
  { id: 'VR-01039', customer: 'Sofia Garcia', provider: 'Precision Motor Works', service: 'Auto shop', status: 'Diagnosing', time: '09:56 AM' },
  { id: 'VR-01038', customer: 'Daniel Cruz', provider: 'RoadReady Auto Care', service: 'Auto shop', status: 'Vehicle Arrived', time: '09:40 AM' },
  { id: 'VR-01037', customer: 'Andrea Lim', provider: 'Ben Roadside Services', service: 'Onsite mechanic', status: 'Completed', time: '09:12 AM' },
  { id: 'VR-01036', customer: 'Paolo Ramos', provider: 'SafeTow Assistance', service: 'Towing', status: 'Rejected', time: '08:48 AM' },
];
export const providers = [
  { label: 'Onsite Mechanics', count: 78, percent: 48 },
  { label: 'Auto Shops', count: 54, percent: 33 },
  { label: 'Towing Companies', count: 32, percent: 19 },
];
export const activity = [
  { day: 'Fri', date: 'Sep 04', count: 28 }, { day: 'Sat', date: 'Sep 05', count: 42 },
  { day: 'Sun', date: 'Sep 06', count: 35 }, { day: 'Mon', date: 'Sep 07', count: 54 },
  { day: 'Tue', date: 'Sep 08', count: 46 }, { day: 'Wed', date: 'Sep 09', count: 62 },
  { day: 'Thu', date: 'Sep 10', count: 48 },
];
