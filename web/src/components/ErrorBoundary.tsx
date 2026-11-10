import { Component, type ErrorInfo, type ReactNode } from "react";

/** A render crash should show a way back, not a blank page — this is a judge-facing app. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("HANDOVER crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="wrap" style={{ paddingTop: 80, paddingBottom: 80 }}>
        <div className="eyebrow">something broke</div>
        <h1 style={{ marginTop: 10 }}>This view failed to render.</h1>
        <p className="dim mt-s" style={{ maxWidth: "58ch" }}>
          The demo state is in local storage, so a reload usually recovers it. If it keeps failing,
          reset the simulated data.
        </p>
        <pre className="receipt mt">{String(this.state.error?.message ?? this.state.error)}</pre>
        <div className="row mt" style={{ gap: 8 }}>
          <button className="btn primary" onClick={() => window.location.reload()}>reload</button>
          <button
            className="btn"
            onClick={() => {
              localStorage.removeItem("handover.demo.v1");
              window.location.href = window.location.pathname;
            }}
          >
            reset demo data
          </button>
        </div>
      </div>
    );
  }
}
