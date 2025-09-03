import { DownloadConfig } from './brand';

export const downloadConfig: DownloadConfig = {
  enabled: true,
  platforms: {
    windows: {
      url: 'https://github.com/your-org/reetreev-desktop/releases/latest/download/Reetreev-Setup.exe',
      filename: 'Reetreev-Setup.exe'
    },
    mac: {
      url: 'https://github.com/your-org/reetreev-desktop/releases/latest/download/Reetreev.dmg',
      filename: 'Reetreev.dmg'
    },
    linux: {
      url: 'https://github.com/your-org/reetreev-desktop/releases/latest/download/Reetreev.AppImage',
      filename: 'Reetreev.AppImage'
    }
  }
};

export const detectUserPlatform = (): string => {
  if (typeof window === 'undefined') return 'unknown';
  
  const userAgent = window.navigator.userAgent.toLowerCase();
  
  if (userAgent.includes('win')) return 'windows';
  if (userAgent.includes('mac')) return 'mac';
  if (userAgent.includes('linux')) return 'linux';
  
  return 'unknown';
};

export const getDownloadUrl = (platform?: string): string => {
  const detectedPlatform = platform || detectUserPlatform();
  
  switch (detectedPlatform) {
    case 'windows':
      return downloadConfig.platforms.windows.url;
    case 'mac':
      return downloadConfig.platforms.mac.url;
    case 'linux':
      return downloadConfig.platforms.linux?.url || downloadConfig.platforms.windows.url;
    default:
      return downloadConfig.platforms.windows.url;
  }
};

export const getDownloadFilename = (platform?: string): string => {
  const detectedPlatform = platform || detectUserPlatform();
  
  switch (detectedPlatform) {
    case 'windows':
      return downloadConfig.platforms.windows.filename;
    case 'mac':
      return downloadConfig.platforms.mac.filename;
    case 'linux':
      return downloadConfig.platforms.linux?.filename || downloadConfig.platforms.windows.filename;
    default:
      return downloadConfig.platforms.windows.filename;
  }
};

export const initiateDownload = (platform?: string): void => {
  const downloadUrl = getDownloadUrl(platform);
  const filename = getDownloadFilename(platform);
  
  // Create a temporary anchor element to trigger download
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const getPlatformDisplayName = (platform?: string): string => {
  const detectedPlatform = platform || detectUserPlatform();
  
  switch (detectedPlatform) {
    case 'windows':
      return 'Windows';
    case 'mac':
      return 'macOS';
    case 'linux':
      return 'Linux';
    default:
      return 'Desktop';
  }
};
