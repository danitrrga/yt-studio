'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback: (err: Error, retry: () => void) => React.ReactNode;
}

interface State {
  error: Error | null;
}

export class EditorErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Editor mount error:', error, info);
  }

  retry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return this.props.fallback(this.state.error, this.retry);
    }
    return this.props.children;
  }
}
