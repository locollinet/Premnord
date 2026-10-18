import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends (React.Component as unknown as {
  new (props: Props): {
    props: Props;
    state: State;
    setState(state: Partial<State> | ((prevState: State) => Partial<State>)): void;
    render(): ReactNode;
  };
}) {
  public state: State;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }


  public static getDerivedStateFromError(error: Error): State {

    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component tree:', error, errorInfo);
  }

  public handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center shadow-2xl border border-slate-200">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-serif font-bold text-slate-900 mb-2">
              Une anomalie est survenue
            </h2>
            <p className="text-sm text-slate-600 mb-6">
              L'application a rencontré un incident inattendu. Cliquez sur le bouton ci-dessous pour recharger l'interface en toute sécurité.
            </p>
            {this.state.error && (
              <div className="p-3 bg-slate-100 rounded-lg text-left text-xs font-mono text-slate-700 mb-6 overflow-auto max-h-32">
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={this.handleReload}
              className="w-full py-3 bg-amber-700 hover:bg-amber-800 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Recharger l'application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
