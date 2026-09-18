import { Prisma, prisma, type PostingSide, type TransactionType } from '@hirsolve/db';

export type PostingInput = { accountId: string; side: PostingSide; amount: Prisma.Decimal | string | number; currency: string; memo?: string };
export type TransactionInput = { reference: string; type: TransactionType; currency: string; description?: string; idempotencyKey?: string; metadata?: Prisma.InputJsonValue; postings: PostingInput[] };

export class LedgerError extends Error { constructor(message: string) { super(message); this.name = 'LedgerError'; } }

export function assertBalanced(postings: Pick<PostingInput, 'side' | 'amount'>[]): void {
  if (postings.length < 2) throw new LedgerError('A transaction requires at least two postings');
  const debit = postings.filter((p) => p.side === 'DEBIT').reduce((sum, p) => sum.plus(new Prisma.Decimal(p.amount)), new Prisma.Decimal(0));
  const credit = postings.filter((p) => p.side === 'CREDIT').reduce((sum, p) => sum.plus(new Prisma.Decimal(p.amount)), new Prisma.Decimal(0));
  if (debit.lte(0) || credit.lte(0) || !debit.equals(credit)) throw new LedgerError('Ledger transaction is not balanced');
  if (postings.some((p) => new Prisma.Decimal(p.amount).lte(0))) throw new LedgerError('Posting amounts must be positive');
}

export async function createTransaction(input: TransactionInput) {
  assertBalanced(input.postings);
  return prisma.$transaction(async (tx) => {
    const existing = input.idempotencyKey ? await tx.ledgerTransaction.findUnique({ where: { idempotencyKey: input.idempotencyKey } }) : null;
    if (existing) return existing;
    const transaction = await tx.ledgerTransaction.create({ data: { reference: input.reference, type: input.type, currency: input.currency, description: input.description, idempotencyKey: input.idempotencyKey, metadata: input.metadata, status: 'POSTED', postedAt: new Date(), postings: { create: input.postings.map((posting) => ({ accountId: posting.accountId, side: posting.side, amount: new Prisma.Decimal(posting.amount), currency: posting.currency, memo: posting.memo })) } }, include: { postings: true } });
    return transaction;
  });
}

export async function getAccountBalance(accountId: string, currency: string) {
  const postings = await prisma.ledgerPosting.findMany({ where: { accountId, currency, transaction: { status: 'POSTED' } }, select: { side: true, amount: true } });
  return postings.reduce((balance, posting) => posting.side === 'DEBIT' ? balance.plus(posting.amount) : balance.minus(posting.amount), new Prisma.Decimal(0));
}

export async function createIdempotencyKey(input: { userId: string; key: string; operation: string; requestHash: string; expiresAt: Date }) {
  return prisma.idempotencyKey.create({ data: input });
}

export const ledger = { createTransaction, createPosting: (posting: PostingInput) => posting, assertBalanced, getAccountBalance, createIdempotencyKey };
