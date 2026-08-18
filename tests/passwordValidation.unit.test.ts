import { describe, expect, it } from 'vitest';
import { getPasswordStrengthText, validatePassword, validatePasswordMatch } from '../utils/passwordValidation';

describe('validatePassword', () => {
  it('accepts a password that meets all rules', () => {
    const result = validatePassword('SecurePass123!');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects short passwords', () => {
    const result = validatePassword('Short1!');
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('13 characters'))).toBe(true);
  });

  it('requires lowercase, uppercase, number, and special character', () => {
    expect(validatePassword('abcdefghijklm').isValid).toBe(false);
    expect(validatePassword('ABCDEFGHIJKLMN').isValid).toBe(false);
    expect(validatePassword('Abcdefghijklm1').isValid).toBe(false);
    expect(validatePassword('Abcdefghijklm!').isValid).toBe(false);
  });
});

describe('validatePasswordMatch', () => {
  it('returns true when passwords match', () => {
    expect(validatePasswordMatch('SecurePass123!', 'SecurePass123!')).toBe(true);
  });

  it('returns false when passwords differ', () => {
    expect(validatePasswordMatch('SecurePass123!', 'OtherPass123!')).toBe(false);
  });
});

describe('getPasswordStrengthText', () => {
  it('reports strong password when valid', () => {
    expect(getPasswordStrengthText(validatePassword('SecurePass123!'))).toBe('✓ Strong password');
  });

  it('reports remaining requirements when invalid', () => {
    const text = getPasswordStrengthText(validatePassword('short'));
    expect(text).toMatch(/requirements remaining/);
  });
});
