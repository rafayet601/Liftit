import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class RouteErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        const error = this.props.error || this.state.error;

        if (!this.state.hasError && !this.props.error) return this.props.children;

        return (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
                    <AlertTriangle className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-white">Something went wrong</p>
                <p className="mt-1 text-xs text-zinc-500 break-words">
                    {error?.message || 'An unexpected error occurred.'}
                </p>
                <button
                    type="button"
                    onClick={this.handleRetry}
                    className="mt-4 btn-secondary inline-flex items-center gap-2 text-xs"
                >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry
                </button>
            </div>
        );
    }
}
