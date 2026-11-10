import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Shows what broke instead of a blank window.
 *
 * A render error anywhere would otherwise leave the user with a white page
 * and no clue; this keeps the message and the component stack on screen.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('render failed', error, info.componentStack);
  }

  override render() {
    if (this.state.error !== null) {
      return (
        <div style={{ padding: 24, fontFamily: 'monospace', fontSize: 13, color: '#b0443a' }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>界面出错了</div>
          <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{this.state.error.message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8, color: '#656360' }}>
            {this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
