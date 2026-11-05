export type ComplaintStatus = 'Pending' | 'Under Review' | 'Resolved' | 'Dismissed';
export type ComplaintService = 'onsite-mechanic' | 'towing-company' | 'shop-owner' | 'homegarage';

export interface Complaint {
  id: string;
  bookingId: string;
  bookingReference: string;
  bookingType: ComplaintService;
  bookingStatusAtSubmission: string;
  reporterId: string;
  reporterName: string;
  reporterType: 'Vehicle Owner' | 'Provider';
  reportedUserId: string;
  reportedUserName: string;
  category: string;
  explanation: string;
  status: ComplaintStatus;
  adminNote?: string;
  createdAt?: { toDate: () => Date };
  updatedAt?: { toDate: () => Date };
  reviewedAt?: { toDate: () => Date };
}
