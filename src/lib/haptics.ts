/**
 * Haptic feedback utility for mobile and tactile web interactions.
 * Respects platform capabilities and degrades silently if unsupported.
 */

export type HapticType = 'light' | 'medium' | 'success' | 'warning' | 'toggle';

export function triggerHaptic(type: HapticType = 'light'): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || !('vibrate' in navigator)) {
    return;
  }

  try {
    switch (type) {
      case 'light':
        navigator.vibrate(10);
        break;
      case 'medium':
        navigator.vibrate(22);
        break;
      case 'toggle':
        navigator.vibrate(15);
        break;
      case 'success':
        navigator.vibrate([12, 28, 16]);
        break;
      case 'warning':
        navigator.vibrate([25, 40, 25]);
        break;
    }
  } catch {
    // Silently ignore if blocked by browser policy
  }
}

