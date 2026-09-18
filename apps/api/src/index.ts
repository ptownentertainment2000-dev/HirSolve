import { checkDatabaseHealth } from '@hirsolve/db';

const health = await checkDatabaseHealth();
console.log(JSON.stringify({ service: 'hirsolve-api', database: health.ok ? 'up' : 'down' }));
if (!health.ok) process.exitCode = 1;
