import React, { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('Plugin crashed:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100%', padding: 24, color: '#64748b',
          fontSize: 14, textAlign: 'center',
        }}>
          插件加载异常，请刷新重试
        </div>
      );
    }
    return this.props.children;
  }
}
