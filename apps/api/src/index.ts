import { auth } from '@hirsolve/auth';

console.log('HirSolve API booted');
console.log(auth.createSession('user_123', 'buyer@hirsolve.dev', ['CUSTOMER']));
