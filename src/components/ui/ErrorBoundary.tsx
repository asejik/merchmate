import { Component, type ErrorInfo, type ReactNode } from 'react';
import { FatalError } from './FatalError';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

/** Catches a crash while rendering so the user sees a way forward instead of a blank screen. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <FatalError title="Something went wrong">
        <p>MerchMate hit an unexpected problem. Your invoices and clients are stored on this device and have not been deleted.</p>
        <p>Try again. If it keeps happening, go to Settings and save a backup, then contact support.</p>
      </FatalError>
    );
  }
}
