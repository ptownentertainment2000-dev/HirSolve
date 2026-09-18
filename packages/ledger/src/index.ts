export type Posting = {
  accountCode: string;
  side: 'DEBIT' | 'CREDIT';
  amount: string;
  currency: string;
  memo?: string;
};

export const ledger = {
  name: 'ledger',
  createBalancedPostings: (postings: Posting[]) => postings,
};
