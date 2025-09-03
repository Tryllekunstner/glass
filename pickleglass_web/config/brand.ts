export interface BrandConfig {
  name: string;
  displayName: string;
  protocol: string;
  logoSymbol: string;
  logoWord: string;
  websiteUrl: string;
}

export interface DownloadConfig {
  enabled: boolean;
  platforms: {
    windows: {
      url: string;
      filename: string;
    };
    mac: {
      url: string;
      filename: string;
    };
    linux?: {
      url: string;
      filename: string;
    };
  };
}

export const brandConfig: BrandConfig = {
  name: 'reetreev',
  displayName: 'Reetreev',
  protocol: 'reetreev',
  logoSymbol: '/reetreev-symbol.svg',
  logoWord: '/reetreev-word.svg',
  websiteUrl: 'https://reetreev.com'
};

export const getBrandConfig = (): BrandConfig => {
  return brandConfig;
};

export const createPlaceholderLogo = (type: 'symbol' | 'word'): string => {
  const baseColor = '#3B82F6'; // Blue color for branding
  
  if (type === 'symbol') {
    return `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="${baseColor}"/>
      <path d="M8 12h16v2H8v-2zm0 4h16v2H8v-2zm0 4h12v2H8v-2z" fill="white"/>
      <circle cx="22" cy="20" r="2" fill="white"/>
    </svg>`;
  } else {
    return `<svg width="120" height="32" viewBox="0 0 120 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="${baseColor}"/>
      <path d="M8 12h16v2H8v-2zm0 4h16v2H8v-2zm0 4h12v2H8v-2z" fill="white"/>
      <circle cx="22" cy="20" r="2" fill="white"/>
      <text x="40" y="20" font-family="Arial, sans-serif" font-size="14" font-weight="600" fill="${baseColor}" dominant-baseline="middle">Reetreev</text>
    </svg>`;
  }
};
