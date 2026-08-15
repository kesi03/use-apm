import React from "react";
import { useApm } from "./useApm";

export class ApmErrorBoundary extends React.Component<
  { children: React.ReactNode; apm: ReturnType<typeof useApm> },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  componentDidCatch(error: any) {
    this.setState({ hasError: true });
    // captureError returns a Promise; componentDidCatch must not return one.
    // Fire-and-forget and handle errors to avoid unhandled promise rejections.
    this.props.apm.captureError(error).catch(() => {});
  }

  render() {
    if (this.state.hasError) {
      return <div>Something went wrong.</div>;
    }
    return this.props.children;
  }
}
