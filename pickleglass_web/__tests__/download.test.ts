/**
 * Download Functionality Tests
 * 
 * These tests validate that the desktop download functionality
 * works correctly with platform detection and URL generation.
 */

import { 
  detectUserPlatform, 
  getPlatformDisplayName, 
  getDownloadUrl, 
  getDownloadFilename,
  downloadConfig 
} from '../config/download';

// Mock window object for different platforms
const mockUserAgent = (userAgent: string) => {
  Object.defineProperty(window, 'navigator', {
    value: { userAgent },
    writable: true
  });
};

describe('Platform Detection', () => {
  test('should detect Windows platform', () => {
    mockUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    expect(detectUserPlatform()).toBe('windows');
  });

  test('should detect macOS platform', () => {
    mockUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    expect(detectUserPlatform()).toBe('mac');
  });

  test('should detect Linux platform', () => {
    mockUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36');
    expect(detectUserPlatform()).toBe('linux');
  });

  test('should return unknown for unrecognized platform', () => {
    mockUserAgent('Unknown Browser');
    expect(detectUserPlatform()).toBe('unknown');
  });
});

describe('Platform Display Names', () => {
  test('should return correct display names', () => {
    expect(getPlatformDisplayName('windows')).toBe('Windows');
    expect(getPlatformDisplayName('mac')).toBe('macOS');
    expect(getPlatformDisplayName('linux')).toBe('Linux');
    expect(getPlatformDisplayName('unknown')).toBe('Desktop');
  });
});

describe('Download URLs', () => {
  test('should return correct download URLs for each platform', () => {
    expect(getDownloadUrl('windows')).toBe(downloadConfig.platforms.windows.url);
    expect(getDownloadUrl('mac')).toBe(downloadConfig.platforms.mac.url);
    expect(getDownloadUrl('linux')).toBe(downloadConfig.platforms.linux?.url);
  });

  test('should fallback to Windows URL for unknown platform', () => {
    expect(getDownloadUrl('unknown')).toBe(downloadConfig.platforms.windows.url);
  });
});

describe('Download Filenames', () => {
  test('should return correct filenames for each platform', () => {
    expect(getDownloadFilename('windows')).toBe('Reetreev-Setup.exe');
    expect(getDownloadFilename('mac')).toBe('Reetreev.dmg');
    expect(getDownloadFilename('linux')).toBe('Reetreev.AppImage');
  });

  test('should fallback to Windows filename for unknown platform', () => {
    expect(getDownloadFilename('unknown')).toBe('Reetreev-Setup.exe');
  });
});

describe('Download Configuration', () => {
  test('should have proper download configuration structure', () => {
    expect(downloadConfig).toHaveProperty('enabled');
    expect(downloadConfig).toHaveProperty('platforms');
    expect(downloadConfig.enabled).toBe(true);
  });

  test('should have all required platform configurations', () => {
    expect(downloadConfig.platforms).toHaveProperty('windows');
    expect(downloadConfig.platforms).toHaveProperty('mac');
    expect(downloadConfig.platforms).toHaveProperty('linux');
    
    expect(downloadConfig.platforms.windows).toHaveProperty('url');
    expect(downloadConfig.platforms.windows).toHaveProperty('filename');
    expect(downloadConfig.platforms.mac).toHaveProperty('url');
    expect(downloadConfig.platforms.mac).toHaveProperty('filename');
  });

  test('should have Reetreev-branded filenames', () => {
    expect(downloadConfig.platforms.windows.filename).toContain('Reetreev');
    expect(downloadConfig.platforms.mac.filename).toContain('Reetreev');
    expect(downloadConfig.platforms.linux?.filename).toContain('Reetreev');
  });
});

describe('Download Initiation', () => {
  test('should create download link with correct attributes', () => {
    // Mock document.createElement and appendChild
    const mockLink = {
      href: '',
      download: '',
      style: { display: '' },
      click: jest.fn()
    };
    
    const createElementSpy = jest.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
    const appendChildSpy = jest.spyOn(document.body, 'appendChild').mockImplementation();
    const removeChildSpy = jest.spyOn(document.body, 'removeChild').mockImplementation();

    // Import and test initiateDownload
    const { initiateDownload } = require('../config/download');
    
    initiateDownload('windows');
    
    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(mockLink.href).toBe(downloadConfig.platforms.windows.url);
    expect(mockLink.download).toBe(downloadConfig.platforms.windows.filename);
    expect(mockLink.style.display).toBe('none');
    expect(mockLink.click).toHaveBeenCalled();
    expect(appendChildSpy).toHaveBeenCalledWith(mockLink);
    expect(removeChildSpy).toHaveBeenCalledWith(mockLink);

    // Cleanup
    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });
});
