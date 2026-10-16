export interface PlatformInfo {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  standalone: boolean; // already running from the home screen
}

export const IOS_INSTALL_STEPS = [
  'Open MerchMate in Safari',
  'Tap the Share button',
  'Choose "Add to Home Screen"',
];

export function isIOS({ userAgent, platform, maxTouchPoints }: PlatformInfo): boolean {
  // iPadOS reports itself as a Mac, but only the iPad has a touch screen
  return /iPhone|iPad|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
}

/**
 * iPhones and iPads clear a website's stored data after about a week without a visit, unless it
 * is installed on the home screen. Other browsers can be asked for protection directly.
 */
export function shouldSuggestInstall(info: PlatformInfo): boolean {
  return isIOS(info) && !info.standalone;
}

export function currentPlatform(): PlatformInfo {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone: window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
  };
}
