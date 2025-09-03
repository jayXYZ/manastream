"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

class LifeTrackerErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(
      "LifeTracker Error Boundary caught an error:",
      error,
      errorInfo,
    );
  }

  handleClearStorage = () => {
    try {
      localStorage.removeItem("lifetracker-settings");
      console.log("Cleared localStorage due to error");
    } catch (e) {
      console.warn("Failed to clear localStorage:", e);
    }
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="text-xl font-bold text-red-600">
                Something went wrong
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                There was an error loading the LifeTracker. This might be due to
                corrupted stored settings.
              </p>
              <Button
                onClick={this.handleClearStorage}
                className="w-full"
                variant="destructive"
              >
                Clear Stored Settings & Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default LifeTrackerErrorBoundary;
