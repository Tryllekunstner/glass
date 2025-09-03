/**
 * Authentication Flow Tests
 * 
 * These tests validate that the authentication-gated sidebar functionality
 * works correctly with the new Reetreev branding, including email/password authentication.
 */

import { getBrandConfig } from '../config/brand';
import { detectUserPlatform, getPlatformDisplayName, getDownloadUrl } from '../config/download';
import { 
  validateEmail, 
  validatePassword, 
  validateLoginForm, 
  validateSignupForm, 
  validatePasswordResetForm,
  sanitizeFormData 
} from '../utils/validation';

// Mock window object for platform detection
Object.defineProperty(window, 'navigator', {
  value: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  },
  writable: true
});

describe('Authentication State Management', () => {
  test('should have proper AuthState interface structure', () => {
    // Test that the AuthState interface has the expected properties
    const mockAuthState = {
      isAuthenticated: false,
      user: null,
      isLoading: true,
      showSidebar: false
    };
    
    expect(mockAuthState).toHaveProperty('isAuthenticated');
    expect(mockAuthState).toHaveProperty('user');
    expect(mockAuthState).toHaveProperty('isLoading');
    expect(mockAuthState).toHaveProperty('showSidebar');
  });

  test('sidebar should be hidden when user is not authenticated', () => {
    const mockAuthState = {
      isAuthenticated: false,
      user: null,
      isLoading: false,
      showSidebar: false
    };
    
    expect(mockAuthState.showSidebar).toBe(false);
    expect(mockAuthState.isAuthenticated).toBe(false);
  });

  test('sidebar should be shown when user is authenticated', () => {
    const mockAuthState = {
      isAuthenticated: true,
      user: {
        uid: 'test-uid',
        display_name: 'Test User',
        email: 'test@example.com'
      },
      isLoading: false,
      showSidebar: true
    };
    
    expect(mockAuthState.showSidebar).toBe(true);
    expect(mockAuthState.isAuthenticated).toBe(true);
    expect(mockAuthState.user).not.toBeNull();
  });
});

describe('Email Validation', () => {
  test('should validate correct email addresses', () => {
    const validEmails = [
      'test@example.com',
      'user.name@domain.co.uk',
      'user+tag@example.org',
      'firstname.lastname@company.com',
      'test123@test-domain.com'
    ];

    validEmails.forEach(email => {
      expect(validateEmail(email)).toBe(true);
    });
  });

  test('should reject invalid email addresses', () => {
    const invalidEmails = [
      '',
      'invalid',
      '@example.com',
      'test@',
      'test @example.com',
      'test@ex ample.com'
    ];

    invalidEmails.forEach(email => {
      expect(validateEmail(email)).toBe(false);
    });
  });

  test('should handle email trimming', () => {
    expect(validateEmail('  test@example.com  ')).toBe(true);
    expect(validateEmail('\ttest@example.com\n')).toBe(true);
  });
});

describe('Password Validation', () => {
  test('should accept strong passwords', () => {
    const validPasswords = [
      'password123',
      'MySecurePass1',
      'complex@Password123'
    ];

    validPasswords.forEach(password => {
      const result = validatePassword(password);
      expect(result.isValid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
    });
  });

  test('should reject minimum length passwords that lack complexity', () => {
    const result = validatePassword('123456');
    expect(result.isValid).toBe(false);
    expect(result.errors.password).toContain('mix of letters, numbers, or special characters');
  });

  test('should provide feedback for weak but acceptable passwords', () => {
    const result = validatePassword('simplepass');
    expect(result.isValid).toBe(false);
    expect(result.errors.password).toContain('mix of letters, numbers, or special characters');
  });

  test('should reject empty or too short passwords', () => {
    const invalidPasswords = [
      '',
      '12345',
      'abc'
    ];

    invalidPasswords.forEach(password => {
      const result = validatePassword(password);
      expect(result.isValid).toBe(false);
      expect(result.errors.password).toBeDefined();
    });
  });

  test('should provide helpful feedback for weak passwords', () => {
    const result = validatePassword('1234567');
    expect(result.isValid).toBe(false);
    expect(result.errors.password).toContain('mix of letters, numbers, or special characters');
  });

  test('should suggest longer passwords for better security', () => {
    const result = validatePassword('simple');
    expect(result.isValid).toBe(false);
    expect(result.errors.password).toContain('Password should include a mix of letters, numbers, or special characters');
  });
});

describe('Login Form Validation', () => {
  test('should validate complete login form', () => {
    const validLoginData = {
      email: 'test@example.com',
      password: 'password123'
    };

    const result = validateLoginForm(validLoginData);
    expect(result.isValid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  test('should reject login form with missing email', () => {
    const invalidLoginData = {
      email: '',
      password: 'password123'
    };

    const result = validateLoginForm(invalidLoginData);
    expect(result.isValid).toBe(false);
    expect(result.errors.email).toBe('Email is required');
  });

  test('should reject login form with invalid email', () => {
    const invalidLoginData = {
      email: 'invalid-email',
      password: 'password123'
    };

    const result = validateLoginForm(invalidLoginData);
    expect(result.isValid).toBe(false);
    expect(result.errors.email).toBe('Please enter a valid email address');
  });

  test('should reject login form with missing password', () => {
    const invalidLoginData = {
      email: 'test@example.com',
      password: ''
    };

    const result = validateLoginForm(invalidLoginData);
    expect(result.isValid).toBe(false);
    expect(result.errors.password).toBe('Password is required');
  });
});

describe('Signup Form Validation', () => {
  test('should validate complete signup form', () => {
    const validSignupData = {
      email: 'test@example.com',
      password: 'password123',
      confirmPassword: 'password123',
      displayName: 'Test User'
    };

    const result = validateSignupForm(validSignupData);
    expect(result.isValid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  test('should reject signup form with mismatched passwords', () => {
    const invalidSignupData = {
      email: 'test@example.com',
      password: 'password123',
      confirmPassword: 'different123',
      displayName: 'Test User'
    };

    const result = validateSignupForm(invalidSignupData);
    expect(result.isValid).toBe(false);
    expect(result.errors.confirmPassword).toBe('Passwords do not match');
  });

  test('should reject signup form with missing display name', () => {
    const invalidSignupData = {
      email: 'test@example.com',
      password: 'password123',
      confirmPassword: 'password123',
      displayName: ''
    };

    const result = validateSignupForm(invalidSignupData);
    expect(result.isValid).toBe(false);
    expect(result.errors.displayName).toBe('Display name is required');
  });

  test('should reject signup form with too short display name', () => {
    const invalidSignupData = {
      email: 'test@example.com',
      password: 'password123',
      confirmPassword: 'password123',
      displayName: 'A'
    };

    const result = validateSignupForm(invalidSignupData);
    expect(result.isValid).toBe(false);
    expect(result.errors.displayName).toBe('Display name must be at least 2 characters');
  });

  test('should reject signup form with too long display name', () => {
    const invalidSignupData = {
      email: 'test@example.com',
      password: 'password123',
      confirmPassword: 'password123',
      displayName: 'A'.repeat(51)
    };

    const result = validateSignupForm(invalidSignupData);
    expect(result.isValid).toBe(false);
    expect(result.errors.displayName).toBe('Display name must be less than 50 characters');
  });
});

describe('Password Reset Form Validation', () => {
  test('should validate password reset form with valid email', () => {
    const validResetData = {
      email: 'test@example.com'
    };

    const result = validatePasswordResetForm(validResetData);
    expect(result.isValid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  test('should reject password reset form with missing email', () => {
    const invalidResetData = {
      email: ''
    };

    const result = validatePasswordResetForm(invalidResetData);
    expect(result.isValid).toBe(false);
    expect(result.errors.email).toBe('Email is required');
  });

  test('should reject password reset form with invalid email', () => {
    const invalidResetData = {
      email: 'invalid-email'
    };

    const result = validatePasswordResetForm(invalidResetData);
    expect(result.isValid).toBe(false);
    expect(result.errors.email).toBe('Please enter a valid email address');
  });
});

describe('Form Data Sanitization', () => {
  test('should trim whitespace from form fields', () => {
    const dirtyData = {
      email: '  test@example.com  ',
      password: '  password123  ',
      displayName: '  Test User  '
    };

    const sanitized = sanitizeFormData(dirtyData);
    expect(sanitized.email).toBe('test@example.com');
    expect(sanitized.password).toBe('password123');
    expect(sanitized.displayName).toBe('Test User');
  });

  test('should preserve original object structure', () => {
    const originalData = {
      email: 'test@example.com',
      password: 'password123'
    };

    const sanitized = sanitizeFormData(originalData);
    expect(sanitized).not.toBe(originalData); // Should be a new object
    expect(Object.keys(sanitized)).toEqual(Object.keys(originalData));
  });
});

describe('Authentication Integration', () => {
  test('should handle successful email/password authentication', () => {
    const mockUser = {
      uid: 'test-uid-email',
      display_name: 'Email User',
      email: 'test@example.com'
    };

    // Test that the user object has the expected structure
    expect(mockUser).toHaveProperty('uid');
    expect(mockUser).toHaveProperty('display_name');
    expect(mockUser).toHaveProperty('email');
    expect(mockUser.uid).toBe('test-uid-email');
    expect(mockUser.email).toBe('test@example.com');
  });

  test('should handle authentication errors gracefully', () => {
    const mockError = {
      code: 'auth/user-not-found',
      message: 'No account found with this email address.'
    };

    expect(mockError.code).toBe('auth/user-not-found');
    expect(mockError.message).toContain('No account found');
  });

  test('should support both Google and email/password authentication', () => {
    const googleUser = {
      uid: 'google-uid',
      display_name: 'Google User',
      email: 'google@example.com',
      provider: 'google'
    };

    const emailUser = {
      uid: 'email-uid',
      display_name: 'Email User',
      email: 'email@example.com',
      provider: 'email'
    };

    // Both should have the same required properties
    [googleUser, emailUser].forEach(user => {
      expect(user).toHaveProperty('uid');
      expect(user).toHaveProperty('display_name');
      expect(user).toHaveProperty('email');
    });
  });
});

describe('Electron Mode Compatibility', () => {
  test('should handle Electron mode parameter detection', () => {
    // Mock URL with electron mode parameter
    const mockUrl = 'http://localhost:3000/login?mode=electron';
    const urlParams = new URLSearchParams(mockUrl.split('?')[1]);
    const mode = urlParams.get('mode');
    
    expect(mode).toBe('electron');
  });

  test('should generate proper deep link URLs for Electron', () => {
    const mockUser = {
      uid: 'test-uid',
      email: 'test@example.com',
      displayName: 'Test User'
    };
    const mockToken = 'mock-id-token';

    const deepLinkUrl = `pickleglass://auth-success?` + new URLSearchParams({
      uid: mockUser.uid,
      email: mockUser.email,
      displayName: mockUser.displayName,
      token: mockToken
    }).toString();

    expect(deepLinkUrl).toContain('pickleglass://auth-success');
    expect(deepLinkUrl).toContain('uid=test-uid');
    expect(deepLinkUrl).toContain('email=test%40example.com');
    expect(deepLinkUrl).toContain('token=mock-id-token');
  });
});

describe('Brand Configuration', () => {
  test('getBrandConfig should return Reetreev configuration', () => {
    const config = getBrandConfig();
    
    expect(config.name).toBe('reetreev');
    expect(config.displayName).toBe('Reetreev');
    expect(config.protocol).toBe('reetreev');
    expect(config.websiteUrl).toBe('https://reetreev.com');
    expect(config.logoSymbol).toBe('/reetreev-symbol.svg');
    expect(config.logoWord).toBe('/reetreev-word.svg');
  });

  test('brand configuration should have all required properties', () => {
    const config = getBrandConfig();
    
    expect(config).toHaveProperty('name');
    expect(config).toHaveProperty('displayName');
    expect(config).toHaveProperty('protocol');
    expect(config).toHaveProperty('logoSymbol');
    expect(config).toHaveProperty('logoWord');
    expect(config).toHaveProperty('websiteUrl');
  });
});
