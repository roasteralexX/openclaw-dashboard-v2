import '@testing-library/jest-dom';
import { afterEach, beforeEach } from 'vitest';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  // Ensure fake timers are restored if a test forgot to
});
