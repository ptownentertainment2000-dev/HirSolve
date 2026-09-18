import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const systemUser = await prisma.user.upsert({
    where: { email: 'system@hirsolve.local' },
    update: {},
    create: {
      email: 'system@hirsolve.local',
      passwordHash: 'system-placeholder',
      status: 'ACTIVE',
      roles: {
        create: [{ role: 'ADMIN' }],
      },
      accounts: {
        create: [
          {
            code: 'SYSTEM-CLEARING',
            name: 'System Clearing',
            type: 'ASSET',
            purpose: 'SYSTEM_CLEARING',
            currency: 'USD',
            isSystem: true,
          },
          {
            code: 'PLATFORM-REVENUE',
            name: 'Platform Revenue',
            type: 'REVENUE',
            purpose: 'PLATFORM_REVENUE',
            currency: 'USD',
            isSystem: true,
          },
        ],
      },
    },
  });

  await prisma.account.upsert({
    where: { code: 'ESCROW-DEFAULT' },
    update: {},
    create: {
      code: 'ESCROW-DEFAULT',
      name: 'Default Escrow',
      type: 'LIABILITY',
      purpose: 'ESCROW',
      currency: 'USD',
      isSystem: true,
    },
  });

  await prisma.account.upsert({
    where: { code: 'WITHDRAWAL-PAYABLE' },
    update: {},
    create: {
      code: 'WITHDRAWAL-PAYABLE',
      name: 'Withdrawal Payable',
      type: 'LIABILITY',
      purpose: 'WITHDRAWAL_PAYABLE',
      currency: 'USD',
      isSystem: true,
    },
  });

  console.log(`Seeded HirSolve system account and default ledger configuration for user ${systemUser.id}`);
}

main()
  .catch((error) => {
    console.error('HirSolve seed failed');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
