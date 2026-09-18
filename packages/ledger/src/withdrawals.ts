import { prisma, type KycStatus, type RiskLevel } from '@hirsolve/db';
import { createTransaction, LedgerError } from '@hirsolve/ledger';
import { consumeStepUpGrant, type AuthSession } from '@hirsolve/auth';
import { Prisma } from '@prisma/client';

export class WithdrawalError extends Error { constructor(message: string) { super(message); this.name = 'WithdrawalError'; } }
export async function requestWithdrawal(input: { session: AuthSession; stepUpToken: string; amount: string | number; currency: string; destinationRef: string; idempotencyKey: string; availableAccountId: string; payableAccountId: string }) {
  await consumeStepUpGrant(input.session, 'LARGE_WITHDRAWAL', input.stepUpToken);
  const amount = new Prisma.Decimal(input.amount);
  if (amount.lte(0)) throw new WithdrawalError('Withdrawal amount must be positive');
  return prisma.$transaction(async tx => {
    const user = await tx.user.findUnique({ where: { id: input.session.userId }, include: { kycProfile: true } });
    if (!user || user.status !== 'ACTIVE' || user.kycProfile?.status !== ('VERIFIED' as KycStatus)) throw new WithdrawalError('Verified KYC is required');
    const risk = await tx.riskAssessment.findFirst({ where: { userId: user.id }, orderBy: { assessedAt: 'desc' } });
    if (!risk || risk.level === ('HIGH' as RiskLevel) || risk.level === ('CRITICAL' as RiskLevel)) throw new WithdrawalError('Withdrawal requires review or is blocked by risk policy');
    const prior = await tx.withdrawalRequest.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (prior) return prior;
    const request = await tx.withdrawalRequest.create({ data: { userId: user.id, amount, currency: input.currency, destinationRef: input.destinationRef, idempotencyKey: input.idempotencyKey, status: 'PENDING_REVIEW', riskLevel: risk.level } });
    const ledgerTx = await createTransaction({ reference: `withdrawal:${request.id}`, type: 'WITHDRAWAL', currency: input.currency, idempotencyKey: `withdrawal:${request.id}`, postings: [{ accountId: input.availableAccountId, side: 'DEBIT', amount, currency: input.currency }, { accountId: input.payableAccountId, side: 'CREDIT', amount, currency: input.currency }] });
    await tx.withdrawalRequest.update({ where: { id: request.id }, data: { ledgerTxId: ledgerTx.id } });
    return { ...request, ledgerTxId: ledgerTx.id };
  });
}
