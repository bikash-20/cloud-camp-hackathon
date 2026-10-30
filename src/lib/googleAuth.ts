/**
 * Google Identity Services (GSI) loader and client wrapper.
 *
 * Loads `https://accounts.google.com/gsi/client` on-demand without external npm bloat,
 * renders standard Google Sign-In buttons, and triggers Google One Tap.
 */

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            context?: 'signin' | 'signup' | 'use';
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: 'standard' | 'icon';
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              width?: number | string;
              locale?: string;
            },
          ) => void;
          prompt: (notification?: (notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

let gsiScriptLoadedPromise: Promise<void> | null = null;

export function loadGsiScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();

  if (!gsiScriptLoadedPromise) {
    gsiScriptLoadedPromise = new Promise((resolve, reject) => {
      const existingScript = document.getElementById('google-gsi-script');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve());
        existingScript.addEventListener('error', (err) => reject(err));
        return;
      }

      const script = document.createElement('script');
      script.id = 'google-gsi-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Identity Services SDK'));
      document.head.appendChild(script);
    });
  }

  return gsiScriptLoadedPromise;
}

export interface InitGoogleAuthOptions {
  clientId: string;
  onSuccess: (credential: string) => void;
  onError?: (err: unknown) => void;
  buttonContainer?: HTMLElement | null;
  buttonWidth?: number;
  promptOneTap?: boolean;
  locale?: string;
}

export async function initGoogleAuth({
  clientId,
  onSuccess,
  onError,
  buttonContainer,
  buttonWidth = 280,
  promptOneTap = true,
  locale = 'en',
}: InitGoogleAuthOptions): Promise<void> {
  if (!clientId) return;

  try {
    await loadGsiScript();
    if (!window.google?.accounts?.id) return;

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (res) => {
        if (res.credential) {
          onSuccess(res.credential);
        }
      },
      auto_select: false,
      cancel_on_tap_outside: true,
      context: 'signin',
    });

    if (buttonContainer) {
      buttonContainer.innerHTML = '';
      window.google.accounts.id.renderButton(buttonContainer, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        width: buttonWidth,
        locale,
      });
    }

    if (promptOneTap) {
      window.google.accounts.id.prompt();
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Google Identity Services initialization skipped:', err);
    onError?.(err);
  }
}
