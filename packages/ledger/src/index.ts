import { Prisma, prisma, type PostingSide, type TransactionType } from '@hirsolve/db';
export type PostingInput = { accountId: string; side: PostingSide; amount: Prisma.Decimal | string | number; currency: string; memo?: string };
export type TransactionInput = { reference: string; type: TransactionType; currency: string; description?: string; idempotencyKey?: string; metadata?: Prisma.InputJsonValue; postings: PostingInput[] };
export class LedgerError extends Error { constructor(message: string) { super(message); this.name = 'LedgerError'; } }
export function assertBalanced(postings: Pick<PostingInput, 'side' | 'amount'>[]) {
  if (postings.length < 2 || postings.some(p => new Prisma.Decimal(p.amount).lte(0))) throw new LedgerError('A transaction requires positive postings');
  const debit = postings.filter(p => p.side === 'DEBIT').reduce((s, p) => s.plus(p.amount), new Prisma.Decimal(0));
  const credit = postings.filter(p => p.side === 'CREDIT').reduce((s, p) => s.plus(p.amount), new Prisma.Decimal(0));
  if (!debit.equals(credit)) throw new LedgerError('Ledger transaction is not balanced');
}
export async function createTransaction(input: TransactionInput) {
  assertBalanced(input.postings);
  return prisma.$transaction(async tx => {
    if (input.idempotencyKey) {
      const existing = await tx.ledgerTransaction.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { postings: true } });
      if (existing) return existing;
    }
    return tx.ledgerTransaction.create({ data: { reference: input.reference, type: input.type, currency: input.currency, description: input.description, idempotencyKey: input.idempotencyKey, metadata: input.metadata, status: 'POSTED', postedAt: new Date(), postings: { create: input.postings.map(p => ({ accountId: p.accountId, side: p.side, amount: new Prisma.Decimal(p.amount), currency: p.currency, memo: p.memo })) } }, include: { postings: true } });
  });
}
export async function getAccountBalance(accountId: string, currency: string) {
  const postings = await prisma.ledgerPosting.findMany({ where: { accountId, currency, transaction: { status: 'POSTED' } }, select: { side: true, amount: true } });
  return postings.reduce((b, p) => p.side === 'DEBIT' ? b.plus(p.amount) : b.minus(p.amount), new Prisma.Decimal(0));
}
export const ledger = { createTransaction, createPosting: (posting: PostingInput) => posting, assertBalanced, getAccountBalance };
