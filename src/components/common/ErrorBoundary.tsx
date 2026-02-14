import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-900 text-white p-8 flex flex-col items-center justify-center font-mono">
                    <div className="max-w-4xl w-full bg-slate-800 p-8 rounded-xl border border-red-500/50 shadow-2xl">
                        <h1 className="text-3xl font-bold text-red-500 mb-4 flex items-center gap-2">
                            Uygulama Hatası (Crash)
                        </h1>
                        <p className="text-slate-300 mb-6">
                            Beklenmeyen bir hata oluştu ve uygulama durduruldu. Lütfen aşağıdaki hata detayını geliştiriciye iletin.
                        </p>

                        <div className="bg-black/50 p-4 rounded-lg overflow-auto max-h-[60vh] border border-slate-700">
                            <p className="font-bold text-red-400 mb-2">{this.state.error?.toString()}</p>
                            <pre className="text-xs text-slate-500 whitespace-pre-wrap">
                                {this.state.errorInfo?.componentStack}
                            </pre>
                        </div>

                        <div className="mt-6 flex gap-4">
                            <button
                                onClick={() => window.location.reload()}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold transition-colors"
                            >
                                Sayfayı Yenile
                            </button>
                            <button
                                onClick={() => window.electronAPI?.restartApp()}
                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-bold transition-colors"
                            >
                                Uygulamayı Yeniden Başlat
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
