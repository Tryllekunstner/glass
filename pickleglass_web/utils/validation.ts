// Form validation utilities for email/password authentication

export interface FormValidation {
  isValid: boolean;
  errors: Record<string, string>;
}

export interface LoginFormData {
  email: string;
  password: string;
}

export interface SignupFormData {
  email: string;
  password: string;
  confirmPassword: string;
  displayName: string;
}

export interface PasswordResetFormData {
  email: string;
}

/**
 * Validates email format using a comprehensive regex pattern
 */
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email.trim());
};

/**
 * Validates password strength and returns detailed feedback
 */
export const validatePassword = (password: string): FormValidation => {
  const errors: Record<string, string> = {};
  
  if (!password) {
    errors.password = 'Password is required';
    return { isValid: false, errors };
  }
  
  if (password.length < 6) {
    errors.password = 'Password must be at least 6 characters long';
  } else if (password.length < 8) {
    errors.password = 'Password should be at least 8 characters for better security';
  }
  
  // Check for basic complexity (optional but recommended)
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  const complexityCount = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar].filter(Boolean).length;
  
  if (password.length >= 6 && complexityCount < 2) {
    errors.password = 'Password should include a mix of letters, numbers, or special characters';
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Validates display name for signup
 */
export const validateDisplayName = (displayName: string): FormValidation => {
  const errors: Record<string, string> = {};
  
  if (!displayName.trim()) {
    errors.displayName = 'Display name is required';
  } else if (displayName.trim().length < 2) {
    errors.displayName = 'Display name must be at least 2 characters';
  } else if (displayName.trim().length > 50) {
    errors.displayName = 'Display name must be less than 50 characters';
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Validates login form data
 */
export const validateLoginForm = (data: LoginFormData): FormValidation => {
  const errors: Record<string, string> = {};
  
  // Validate email
  if (!data.email.trim()) {
    errors.email = 'Email is required';
  } else if (!validateEmail(data.email)) {
    errors.email = 'Please enter a valid email address';
  }
  
  // Validate password
  if (!data.password) {
    errors.password = 'Password is required';
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Validates signup form data
 */
export const validateSignupForm = (data: SignupFormData): FormValidation => {
  const errors: Record<string, string> = {};
  
  // Validate email
  if (!data.email.trim()) {
    errors.email = 'Email is required';
  } else if (!validateEmail(data.email)) {
    errors.email = 'Please enter a valid email address';
  }
  
  // Validate display name
  const displayNameValidation = validateDisplayName(data.displayName);
  if (!displayNameValidation.isValid) {
    Object.assign(errors, displayNameValidation.errors);
  }
  
  // Validate password
  const passwordValidation = validatePassword(data.password);
  if (!passwordValidation.isValid) {
    Object.assign(errors, passwordValidation.errors);
  }
  
  // Validate password confirmation
  if (!data.confirmPassword) {
    errors.confirmPassword = 'Please confirm your password';
  } else if (data.password !== data.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Validates password reset form data
 */
export const validatePasswordResetForm = (data: PasswordResetFormData): FormValidation => {
  const errors: Record<string, string> = {};
  
  if (!data.email.trim()) {
    errors.email = 'Email is required';
  } else if (!validateEmail(data.email)) {
    errors.email = 'Please enter a valid email address';
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Sanitizes form input by trimming whitespace
 */
export const sanitizeFormData = <T extends Record<string, string>>(data: T): T => {
  const sanitized = { ...data } as T;
  
  Object.keys(sanitized).forEach(key => {
    if (typeof sanitized[key] === 'string') {
      (sanitized as any)[key] = sanitized[key].trim();
    }
  });
  
  return sanitized;
};
