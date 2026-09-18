import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { assertBalanced, LedgerError } from '@hirsolve/ledger';

describe('ledger invariants', () => {
  it('accepts balanced postings', () => expect(() => assertBalanced([{ side: 'DEBIT', amount: new Prisma.Decimal('100') }, { side: 'CREDIT', amount: new Prisma.Decimal('100') }])).not.toThrow());
  it('rejects unbalanced postings', () => expect(() => assertBalanced([{ side: 'DEBIT', amount: '100' }, { side: 'CREDIT', amount: '99' }])).toThrow(LedgerError));
  it('rejects non-positive postings', () => expect(() => assertBalanced([{ side: 'DEBIT', amount: '0' }, { side: 'CREDIT', amount: '0' }])).toThrow(LedgerError));
});
