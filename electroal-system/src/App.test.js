import { getValidToken, isTokenValid } from './utils/auth';

describe('auth utils', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('accepts demo token', () => {
    expect(isTokenValid('demo-token')).toBe(true);
  });

  test('removes invalid stored token', () => {
    localStorage.setItem('token', 'invalid-token');
    expect(getValidToken()).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
  });
});
