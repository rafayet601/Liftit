import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

/**
 * Top-level error boundary. Shows a composed, on-brand error surface and
 * lets the user recover without a hard reload.
 */
export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught:', error, errorInfo);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    handleHome = () => {
        this.setState({ hasError: false, error: null });
        if (typeof window !== 'undefined') {
            // Soft navigation; router picks it up on the next tick
            window.history.pushState({}, '', '/');
            window.dispatchEvent(new PopStateEvent('popstate'));
        }
    };

    render() {
        if (!this.state.hasError) return this.props.children;

        const message =
            this.state.error?.message || 'An unexpected error occurred.';

        return (
            <div className="safe-top safe-bottom flex min-h-screen items-center justify-center bg-ink-950 px-4">
                <div className="w-full max-w-md text-center">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400">
                        <AlertTriangle className="h-8 w-8" />
                    </div>
                    <div className="eyebrow mb-2 text-red-400/80">
                        Something broke
                    </div>
                    <h2 className="mb-2 text-2xl font-bold tracking-tight text-white">
                        We hit a snag
                    </h2>
                    <p className="mb-6 break-words text-sm text-zinc-400">
                        {message}
                    </p>
                    <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
                        <button
                            type="button"
                            onClick={this.handleRetry}
                            className="btn-primary inline-flex items-center gap-2"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Try again
                        </button>
                        <button
                            type="button"
                            onClick={this.handleHome}
                            className="btn-outline inline-flex items-center gap-2"
                        >
                            <Home className="h-4 w-4" />
                            Back to dashboard
                        </button>
                    </div>
                </div>
            </div>
        );
    }
}
