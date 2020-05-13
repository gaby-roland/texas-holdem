const { validateNumberInput, validateRegisterForm } = require("../server/secureUtil");

describe("validateRegisterForm", () => {
  it("should not accept badly formatted usernames", () => {
    expect(() => { validateRegisterForm("", "", "", "") }).toThrowError("UsernameInvalid");
    expect(() => { validateRegisterForm("-username", "", "", "") }).toThrowError("UsernameInvalid");
    expect(() => { validateRegisterForm("username-", "", "", "") }).toThrowError("UsernameInvalid");
    expect(() => { validateRegisterForm("username!", "", "", "") }).toThrowError("UsernameInvalid");
  });

  it("should not accept invalid emails", () => {
    expect(() => { validateRegisterForm("username-20", "", "", "") }).toThrowError("EmailInvalid");
    expect(() => { validateRegisterForm("username-20", "SELECT * FROM USERS;", "", "") }).toThrowError("EmailInvalid");
    expect(() => { validateRegisterForm("username-20", "bad-email.com", "", "") }).toThrowError("EmailInvalid");
    expect(() => { validateRegisterForm("username-20", "bad-email@domain@domain2.com", "", "") }).toThrowError("EmailInvalid");
    expect(() => { validateRegisterForm("username-20", "bad-email@domain", "", "") }).toThrowError("EmailInvalid");
  });

  it("should not accept passwords that do not match", () => {
    expect(() => { validateRegisterForm("username-20", "good-email@domain.com", "password1", "password2") }).toThrowError("PasswordConfirmation");

  });

  it("should not accept passwords less than 12 characters", () => {
    expect(() => { validateRegisterForm("username-20", "good-email@domain.com", "password1", "password1") }).toThrowError("PasswordLength");
  });

  it("should not accept passwords with illegal characters", () => {
    expect(() => { validateRegisterForm("username-20", "good-email@domain.com", "(password12)", "(password12)") }).toThrowError("PasswordInvalid");
    expect(() => { validateRegisterForm("username-20", "good-email@domain.com", "^password12^", "^password12^") }).toThrowError("PasswordInvalid");
    expect(() => { validateRegisterForm("username-20", "good-email@domain.com", "'password12'", "'password12'") }).toThrowError("PasswordInvalid");
  });

  it("should not accept passwords without at least 1 upper case letter", () => {
    expect(() => { validateRegisterForm("username-20", "good-email@domain.com", "password1234", "password1234") }).toThrowError("PasswordUpperLetter");
  });

  it("should not accept passwords without at least 1 lower case letter", () => {
    expect(() => { validateRegisterForm("username-20", "good-email@domain.com", "PASSWORD1234", "PASSWORD1234") }).toThrowError("PasswordLowerLetter");
  });

  it("should not accept passwords without at least 2 numbers", () => {
    expect(() => { validateRegisterForm("username-20", "good-email@domain.com", "NotASingleNumber", "NotASingleNumber") }).toThrowError("PasswordNumbers");
    expect(() => { validateRegisterForm("username-20", "good-email@domain.com", "MaybeJust1Number", "MaybeJust1Number") }).toThrowError("PasswordNumbers");
  });

  it("should not accept passwords without at least 2 special characters", () => {
    expect(() => { validateRegisterForm("username-20", "good-email@domain.com", "0SpecialCharacters0", "0SpecialCharacters0") }).toThrowError("PasswordCharacters");
    expect(() => { validateRegisterForm("username-20", "good-email@domain.com", "1Special_Character1", "1Special_Character1") }).toThrowError("PasswordCharacters");
  });

  it("should accept valid registration forms", () => {
    expect(validateRegisterForm("username-20", "good-email@domain.com", "!iStHis5TrOnG3nOuGh#", "!iStHis5TrOnG3nOuGh#")).toBe(true);
    expect(validateRegisterForm("myNameIsGaby", "good-email@domain.company.com", "kSDKa3kdl1$asd_", "kSDKa3kdl1$asd_")).toBe(true);
  });
});

describe("validateNumberInput", () => {
  it("should accept input with only numbers", () => {
    expect(validateNumberInput("1")).toBe(true);
    expect(validateNumberInput("1000")).toBe(true);
    expect(validateNumberInput("123456789")).toBe(true);
  });

  it("should not accept null or empty input", () => {
    expect(validateNumberInput("")).toBe(false);
    expect(validateNumberInput()).toBe(false);
  });

  it("should not accept input with letters", () => {
    expect(validateNumberInput("Hello World!")).toBe(false);
    expect(validateNumberInput("1000E24")).toBe(false);
    expect(validateNumberInput("1000\nE24")).toBe(false);
  });

  it("should not accept input with special characters", () => {
    expect(validateNumberInput("!@#$%^")).toBe(false);
    expect(validateNumberInput("-10000")).toBe(false);
  });

  it("should not accept input with decimal point", () => {
    expect(validateNumberInput("10.5")).toBe(false);
  });
});