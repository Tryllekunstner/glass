import { getUrlParams, isElectronEnvironment, getCurrentUrl, navigateToUrl, isClientSide } from '../utils/clientUtils'

// Mock console.warn to avoid noise in tests
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {})

describe('Client Utils Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    mockConsoleWarn.mockRestore()
  })

  describe('Server-side behavior', () => {
    beforeEach(() => {
      // Mock server-side environment by making window undefined
      Object.defineProperty(global, 'window', {
        value: undefined,
        writable: true,
        configurable: true
      })
    })

    it('getUrlParams should return null on server', () => {
      expect(getUrlParams()).toBeNull()
    })

    it('isElectronEnvironment should return false on server', () => {
      expect(isElectronEnvironment()).toBe(false)
    })

    it('getCurrentUrl should return empty string on server', () => {
      expect(getCurrentUrl()).toBe('')
    })

    it('navigateToUrl should do nothing on server', () => {
      expect(() => navigateToUrl('https://example.com')).not.toThrow()
    })

    it('isClientSide should return false on server', () => {
      expect(isClientSide()).toBe(false)
    })
  })

  describe('Client-side behavior', () => {
    beforeEach(() => {
      // Mock client-side environment
      Object.defineProperty(global, 'window', {
        value: {
          location: {
            search: '?mode=electron&test=value',
            href: 'https://example.com/login?mode=electron'
          },
          require: undefined,
          electronAPI: undefined,
          navigator: {
            userAgent: 'Mozilla/5.0'
          }
        },
        writable: true,
        configurable: true
      })
    })

    it('getUrlParams should return URLSearchParams on client', () => {
      const params = getUrlParams()
      expect(params).toBeInstanceOf(URLSearchParams)
      expect(params?.get('mode')).toBe('electron')
      expect(params?.get('test')).toBe('value')
    })

    it('isElectronEnvironment should detect Electron correctly', () => {
      // Test without Electron indicators
      expect(isElectronEnvironment()).toBe(false)

      // Test with window.require
      ;(global.window as any).require = jest.fn()
      expect(isElectronEnvironment()).toBe(true)

      // Test with electronAPI
      delete (global.window as any).require
      ;(global.window as any).electronAPI = {}
      expect(isElectronEnvironment()).toBe(true)

      // Test with user agent
      delete (global.window as any).electronAPI
      Object.defineProperty((global.window as any).navigator, 'userAgent', {
        value: 'Mozilla/5.0 Electron/1.0.0',
        writable: true
      })
      expect(isElectronEnvironment()).toBe(true)
    })

    it('getCurrentUrl should return current URL on client', () => {
      expect(getCurrentUrl()).toBe('https://example.com/login?mode=electron')
    })

    it('navigateToUrl should set window.location.href on client', () => {
      const testUrl = 'https://test.com'
      navigateToUrl(testUrl)
      expect((global.window as any).location.href).toBe(testUrl)
    })

    it('isClientSide should return true on client', () => {
      expect(isClientSide()).toBe(true)
    })
  })

  describe('Error handling', () => {
    beforeEach(() => {
      // Mock client-side environment with errors
      Object.defineProperty(global, 'window', {
        value: {
          location: {
            get search() {
              throw new Error('Search access error')
            },
            get href() {
              throw new Error('Href access error')
            },
            set href(value) {
              throw new Error('Href set error')
            }
          },
          navigator: {
            get userAgent() {
              throw new Error('UserAgent access error')
            }
          }
        },
        writable: true,
        configurable: true
      })
    })

    it('getUrlParams should handle errors gracefully', () => {
      expect(getUrlParams()).toBeNull()
      expect(console.warn).toHaveBeenCalledWith('Failed to parse URL parameters:', expect.any(Error))
    })

    it('getCurrentUrl should handle errors gracefully', () => {
      expect(getCurrentUrl()).toBe('')
      expect(console.warn).toHaveBeenCalledWith('Failed to get current URL:', expect.any(Error))
    })

    it('navigateToUrl should handle errors gracefully', () => {
      expect(() => navigateToUrl('https://test.com')).not.toThrow()
      expect(console.warn).toHaveBeenCalledWith('Failed to navigate to URL:', expect.any(Error))
    })

    it('isElectronEnvironment should handle errors gracefully', () => {
      expect(isElectronEnvironment()).toBe(false)
    })
  })

  describe('URL parameter parsing', () => {
    beforeEach(() => {
      Object.defineProperty(global, 'window', {
        value: {
          location: {
            search: '?mode=electron&redirect=https%3A%2F%2Fexample.com&empty=&special=%20%21%40%23'
          }
        },
        writable: true,
        configurable: true
      })
    })

    it('should parse complex URL parameters correctly', () => {
      const params = getUrlParams()
      expect(params?.get('mode')).toBe('electron')
      expect(params?.get('redirect')).toBe('https://example.com')
      expect(params?.get('empty')).toBe('')
      expect(params?.get('special')).toBe(' !@#')
      expect(params?.get('nonexistent')).toBeNull()
    })
  })

  describe('Electron detection edge cases', () => {
    it('should handle multiple Electron indicators', () => {
      Object.defineProperty(global, 'window', {
        value: {
          require: jest.fn(),
          electronAPI: {},
          navigator: {
            userAgent: 'Mozilla/5.0 Electron/1.0.0'
          }
        },
        writable: true,
        configurable: true
      })

      expect(isElectronEnvironment()).toBe(true)
    })

    it('should handle case-insensitive user agent detection', () => {
      Object.defineProperty(global, 'window', {
        value: {
          navigator: {
            userAgent: 'Mozilla/5.0 ELECTRON/1.0.0'
          }
        },
        writable: true,
        configurable: true
      })

      expect(isElectronEnvironment()).toBe(true)
    })
  })
})
