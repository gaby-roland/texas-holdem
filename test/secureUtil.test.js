const { validateNumberInput } = require('../server/secureUtil');

describe('validateNumberInput', () => {
  it('should accept input with only numbers', () => {
    expect(validateNumberInput('1')).toBe(true);
    expect(validateNumberInput('1000')).toBe(true);
    expect(validateNumberInput('123456789')).toBe(true);
  });

  it('should not accept null or empty input', () => {
    expect(validateNumberInput('')).toBe(false);
    expect(validateNumberInput()).toBe(false);
  });

  it('should not accept input with letters', () => {
    expect(validateNumberInput('Hello World!')).toBe(false);
    expect(validateNumberInput('1000E24')).toBe(false);
    expect(validateNumberInput('1000\nE24')).toBe(false);
  });

  it('should not accept input with special characters', () => {
    expect(validateNumberInput('!@#$%^')).toBe(false);
    expect(validateNumberInput('-10000')).toBe(false);
  });

  it('should not accept input with decimal point', () => {
    expect(validateNumberInput('10.5')).toBe(false);
  });
});