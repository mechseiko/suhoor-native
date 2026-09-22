/**
 * Password validation utilities for Suhoor mobile app.
 * Returns i18n keys (see translations/*.js) — resolve them with t() at the call site.
 *
 * Requirements:
 * - At least 6 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one special character
 */

export const validatePassword = (password) => {
  if (!password || typeof password !== 'string') {
    return {
      isValid: false,
      errorKey: 'auth.passwordRequired',
    }
  }

  if (password.length < 6) {
    return {
      isValid: false,
      errorKey: 'auth.passwordMinLength',
    }
  }

  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      errorKey: 'auth.passwordUppercase',
    }
  }

  if (!/[a-z]/.test(password)) {
    return {
      isValid: false,
      errorKey: 'auth.passwordLowercase',
    }
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
    return {
      isValid: false,
      errorKey: 'auth.passwordSpecial',
    }
  }

  return { isValid: true, errorKey: null }
}
