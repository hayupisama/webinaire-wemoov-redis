import { HttpRequest } from '@angular/common/http';
import { ThreadStatus } from '../../../features/locks/locks.service';

let balance = 1000;
let expected = 1000;

let noLockState: ThreadStatus = { threadA: 'IDLE', threadB: 'IDLE', done: false };
let withLockState: ThreadStatus = { threadA: 'IDLE', threadB: 'IDLE', done: false };
let lockOwner: string | null = null;

function runNoLockSimulation() {
  noLockState = { threadA: 'READING', threadB: 'READING', done: false };
  
  setTimeout(() => {
    noLockState.threadA = 'DEBITING';
    noLockState.threadB = 'DEBITING';
  }, 1000);

  setTimeout(() => {
    noLockState.threadA = 'DONE';
    noLockState.threadB = 'DONE';
    noLockState.done = true;
    balance = 500; // Race condition! Both read 1000, both wrote 1000-500=500
    expected = 0;
    noLockState.finalActual = 500;
    noLockState.finalExpected = 0;
  }, 2000);
}

function runWithLockSimulation() {
  withLockState = { threadA: 'READING', threadB: 'WAITING_LOCK', done: false };
  lockOwner = 'A';

  setTimeout(() => {
    withLockState.threadA = 'DEBITING';
  }, 1000);

  setTimeout(() => {
    withLockState.threadA = 'DONE';
    balance = 500;
    lockOwner = 'B';
    withLockState.threadB = 'READING';
  }, 2000);

  setTimeout(() => {
    withLockState.threadB = 'DEBITING';
  }, 3000);

  setTimeout(() => {
    withLockState.threadB = 'DONE';
    lockOwner = null;
    withLockState.done = true;
    balance = 0;
    expected = 0;
    withLockState.finalActual = 0;
    withLockState.finalExpected = 0;
  }, 4000);
}

export function locksMock(req: HttpRequest<unknown>): { body: unknown, delay?: number, status?: number } | null {
  const url = req.url;
  const method = req.method;

  if (url.includes('8086/api/account/balance') && method === 'GET') {
    return { body: { balance, expected }, delay: 20 };
  }

  if (url.includes('8086/api/account/reset') && method === 'POST') {
    balance = 1000;
    expected = 1000;
    noLockState = { threadA: 'IDLE', threadB: 'IDLE', done: false };
    withLockState = { threadA: 'IDLE', threadB: 'IDLE', done: false };
    lockOwner = null;
    return { body: { message: 'Reset OK' }, status: 200, delay: 50 };
  }

  // No Lock
  if (url.includes('8086/no-lock/api/debit/concurrent') && method === 'POST') {
    runNoLockSimulation();
    return { body: { message: 'Started' }, status: 200, delay: 50 };
  }

  if (url.includes('8086/no-lock/api/threads/status') && method === 'GET') {
    return { body: noLockState, delay: 20 };
  }

  // With Lock
  if (url.includes('8086/with-lock/api/debit/concurrent') && method === 'POST') {
    runWithLockSimulation();
    return { body: { message: 'Started' }, status: 200, delay: 50 };
  }

  if (url.includes('8086/with-lock/api/threads/status') && method === 'GET') {
    return { body: withLockState, delay: 20 };
  }

  if (url.includes('8086/with-lock/api/lock/status') && method === 'GET') {
    return { body: { owner: lockOwner }, delay: 20 };
  }

  return null;
}
