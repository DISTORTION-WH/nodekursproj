import React, { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-discord-bg flex items-center justify-center">
          <div className="bg-discord-secondary rounded-2xl p-10 text-center max-w-md w-full shadow-xl">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-white text-xl font-bold mb-2">Что-то пошло не так</h2>
            <p className="text-discord-text-muted text-sm mb-6">
              {this.state.error?.message || "Неизвестная ошибка"}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="bg-discord-accent hover:bg-discord-accent-hover text-white px-6 py-2 rounded-lg transition font-semibold"
            >
              Попробовать снова
            </button>
            <button
              onClick={() => window.location.reload()}
              className="ml-3 bg-discord-input hover:bg-discord-input-hover text-discord-text-secondary px-6 py-2 rounded-lg transition"
            >
              Перезагрузить
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
