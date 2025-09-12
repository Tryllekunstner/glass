import { shouldProtectRoute, isPublicRoute } from '../lib/route-config';

describe('Route Protection Configuration', () => {
  describe('shouldProtectRoute', () => {
    test('should return config for home route requiring auth', () => {
      const config = shouldProtectRoute('/');
      expect(config).not.toBeNull();
      expect(config?.requiresAuth).toBe(true);
      expect(config?.redirectTo).toBe('/login');
    });

    test('should return null for login route (public)', () => {
      const config = shouldProtectRoute('/login');
      expect(config).toBeNull();
    });

    test('should return null for API routes (public)', () => {
      const config = shouldProtectRoute('/api/test');
      expect(config).toBeNull();
    });

    test('should return config for activity route requiring auth', () => {
      const config = shouldProtectRoute('/activity');
      expect(config).not.toBeNull();
      expect(config?.requiresAuth).toBe(true);
      expect(config?.redirectTo).toBe('/login');
    });

    test('should return config for profiles route requiring auth', () => {
      const config = shouldProtectRoute('/profiles');
      expect(config).not.toBeNull();
      expect(config?.requiresAuth).toBe(true);
      expect(config?.redirectTo).toBe('/login');
    });

    test('should return config for settings route requiring auth', () => {
      const config = shouldProtectRoute('/settings');
      expect(config).not.toBeNull();
      expect(config?.requiresAuth).toBe(true);
      expect(config?.redirectTo).toBe('/login');
    });

    test('should return config for nested routes requiring auth', () => {
      const config = shouldProtectRoute('/settings/profile');
      expect(config).not.toBeNull();
      expect(config?.requiresAuth).toBe(true);
    });

    test('should protect unlisted routes by default', () => {
      const config = shouldProtectRoute('/some-random-route');
      expect(config).not.toBeNull();
      expect(config?.requiresAuth).toBe(true);
      expect(config?.redirectTo).toBe('/login');
    });
  });

  describe('isPublicRoute', () => {
    test('should identify login as public route', () => {
      expect(isPublicRoute('/login')).toBe(true);
    });

    test('should identify API routes as public', () => {
      expect(isPublicRoute('/api/test')).toBe(true);
    });

    test('should identify protected routes as not public', () => {
      expect(isPublicRoute('/')).toBe(false);
      expect(isPublicRoute('/activity')).toBe(false);
      expect(isPublicRoute('/settings')).toBe(false);
    });
  });
});

describe('Route Matching Logic', () => {
  test('should handle exact path matches correctly', () => {
    // Public routes should return null
    expect(shouldProtectRoute('/login')).toBeNull();
    expect(shouldProtectRoute('/api')).toBeNull();
    
    // Protected routes should return config
    expect(shouldProtectRoute('/')?.requiresAuth).toBe(true);
  });

  test('should handle path prefixes for nested routes', () => {
    // API nested routes should be public
    expect(shouldProtectRoute('/api/users')).toBeNull();
    
    // Settings nested routes should be protected
    const config = shouldProtectRoute('/settings/profile');
    expect(config).not.toBeNull();
    expect(config?.requiresAuth).toBe(true);
  });

  test('should handle root path correctly', () => {
    const config = shouldProtectRoute('/');
    expect(config?.requiresAuth).toBe(true);
    
    // Root should not interfere with other route matching
    expect(isPublicRoute('/login')).toBe(true);
  });
});
