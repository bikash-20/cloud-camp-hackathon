import { Component, type ReactNode } from 'react';
import { T } from '../data';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Top-level error boundary.
 *
 * Without this, any throw inside a screen (e.g. an undefined property in
 * a fixture, a bad API response shape) blanks the entire app. With it,
 * the user sees a styled fallback, can dismiss it, and continue using
 * the rest of the app.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: { componentStack?: string }) {
    // In production this would forward to Sentry / Datadog.
    // eslint-disable-next-line no-console
    console.error('[NutriVision] Unhandled error:', error, info);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        role="alert"
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
          gap: 16,
          fontFamily: 'Inter',
          color: T.ink,
          background: 'linear-gradient(180deg, #F9F2E4 0%, #D0AE92 100%)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 40 }}>⚠️</div>
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>
          Something went wrong
        </h1>
        <p
          style={{
            fontSize: 13,
            color: T.inkSoft,
            margin: 0,
            maxWidth: 320,
            lineHeight: 1.5,
          }}
        >
          The demo hit an unexpected error. You can try again, or reload the page if it keeps happening.
        </p>
        {this.state.error?.message && (
          <pre
            style={{
              fontSize: 11,
              fontFamily: 'IBM Plex Mono, monospace',
              color: T.inkMuted,
              maxWidth: 480,
              padding: '8px 12px',
              borderRadius: 8,
              background: 'rgba(74, 58, 52, 0.08)',
              border: '1px solid rgba(74, 58, 52, 0.15)',
              overflow: 'auto',
              textAlign: 'left',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {this.state.error.message}
          </pre>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={this.reset}
            style={{
              fontFamily: 'Inter',
              fontSize: 13,
              fontWeight: 600,
              padding: '10px 18px',
              borderRadius: 12,
              border: 'none',
              background: T.primary,
              color: '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              fontFamily: 'Inter',
              fontSize: 13,
              fontWeight: 600,
              padding: '10px 18px',
              borderRadius: 12,
              border: `1px solid ${T.primary}`,
              background: 'transparent',
              color: T.primary,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}