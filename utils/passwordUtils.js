/**
 * Password validation utilities for Suhoor mobile app.
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
      error: 'Password is required.',
    }
  }

  if (password.length < 6) {
    return {
      isValid: false,
      error: 'Password must be at least 6 characters long.',
    }
  }

  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      error: 'Password must include at least one uppercase letter.',
    }
  }

  if (!/[a-z]/.test(password)) {
    return {
      isValid: false,
      error: 'Password must include at least one lowercase letter.',
    }
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
    return {
      isValid: false,
      error: 'Password must include at least one special character.',
    }
  }

  return { isValid: true, error: null }
}

export const PASSWORD_REQUIREMENTS_HINT =
  'Min. 6 chars with uppercase, lowercase & special character.'
