/**
 * Diagnostics — Boot tracing & error capture for production APK
 *
 * Usage:
 *   import { SafeBoot, BootLog } from "@/lib/diagnostics";
 *
 *   <SafeBoot>
 *     <App />
 *   </SafeBoot>
 *
 * All boot steps are logged via BootLog.step() and visible via:
 *   adb logcat | grep BOOT
 *
 * If a render crashes, the error boundary shows a diagnostic screen
 * instead of a white screen.
 *
 * @see ZIZ Babylon Ritual — Phase 4: Diagnostic Mode
 */

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { View, Text, ScrollView, Platform, Dimensions } from "react-native";

// ─── Boot Log ────────────────────────────────────────────────────────────────

const BOOT_TAG = "BOOT";

export class BootLog {
  private static steps: string[] = [];
  private static done = false;

  /** Log a boot step with a sequential number and timestamp */
  static step(label: string): void {
    const idx = this.steps.length + 1;
    const msg = `BOOT-${String(idx).padStart(2, "0")} ${label}`;
    // Native Android log — visible via `adb logcat | grep BOOT`
    console.log(`[${BOOT_TAG}] ${msg}`);
    this.steps.push(msg);
  }

  static getSteps(): string[] {
    return [...this.steps];
  }

  static markDone(): void {
    if (this.done) return;
    this.done = true;
    console.log(`[${BOOT_TAG}] BOOT-OK — all steps completed`);
  }

  static isDone(): boolean {
    return this.done;
  }
}

// ─── Boot Error Boundary ──────────────────────────────────────────────────────

interface BootErrorBoundaryProps {
  children: ReactNode;
}

interface BootErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Top-level error boundary.
 * Catches ANY render exception and shows a diagnostic screen instead of white.
 */
export class BootErrorBoundary extends Component<
  BootErrorBoundaryProps,
  BootErrorBoundaryState
> {
  constructor(props: BootErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<BootErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error(`[${BOOT_TAG}] BOOT-FAIL —`, error.message);
    if (errorInfo.componentStack) {
      console.error(`[${BOOT_TAG}] Component stack:`, errorInfo.componentStack);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return <DiagnosticScreen error={this.state.error!} />;
    }
    return this.props.children;
  }
}

// ─── Diagnostic Screen ───────────────────────────────────────────────────────

function DiagnosticScreen({ error }: { error: Error }): React.JSX.Element {
  const bootSteps = BootLog.getSteps();
  const lastStep = bootSteps.length > 0 ? bootSteps[bootSteps.length - 1] : "NONE";
  const screen = Dimensions.get("window");

  return (
    <View style={{ flex: 1, backgroundColor: "#0a0b0f", padding: 24, paddingTop: 60 }}>
      {/* Header */}
      <Text style={{ color: "#ef4444", fontSize: 22, fontWeight: "bold", marginBottom: 8 }}>
        ⚠ Boot Error
      </Text>
      <Text style={{ color: "#8e95a2", fontSize: 13, marginBottom: 20 }}>
        InvoiceStudio Diagnostic Mode
      </Text>

      {/* Device Info */}
      <InfoRow label="Platform" value={`${Platform.OS} ${Platform.Version}`} />
      <InfoRow label="Screen" value={`${screen.width}×${screen.height}`} />
      <InfoRow label="Steps completed" value={`${bootSteps.length}`} />
      <InfoRow label="Last step" value={lastStep} />

      {/* Error details */}
      <View style={{ marginTop: 16, marginBottom: 16, backgroundColor: "#111318", borderRadius: 8, padding: 12 }}>
        <Text style={{ color: "#f59e0b", fontSize: 14, fontWeight: "bold", marginBottom: 4 }}>
          Error:
        </Text>
        <Text style={{ color: "#f0f0f2", fontSize: 13 }}>
          {error.name}: {error.message}
        </Text>
      </View>

      {/* Stack trace */}
      <Text style={{ color: "#8e95a2", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>
        Stack trace:
      </Text>
      <ScrollView style={{ flex: 1, backgroundColor: "#111318", borderRadius: 8, padding: 12, marginBottom: 8 }}>
        <Text style={{ color: "#f0f0f2", fontSize: 11 }}>
          {error.stack || "(no stack trace)"}
        </Text>
      </ScrollView>

      {/* Boot steps */}
      {bootSteps.length > 0 && (
        <View style={{ marginTop: 8, maxHeight: 100 }}>
          <Text style={{ color: "#8e95a2", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>
            Boot steps completed:
          </Text>
          {bootSteps.slice(-5).map((s, i) => (
            <Text key={i} style={{ color: "#22c55e", fontSize: 11 }}>
              ✓ {s}
            </Text>
          ))}
          {bootSteps.length > 5 && (
            <Text style={{ color: "#555b6a", fontSize: 10 }}>...and {bootSteps.length - 5} more</Text>
          )}
        </View>
      )}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View style={{ flexDirection: "row", marginBottom: 4 }}>
      <Text style={{ color: "#8e95a2", fontSize: 13, width: 120 }}>{label}</Text>
      <Text style={{ color: "#f0f0f2", fontSize: 13 }}>{value}</Text>
    </View>
  );
}

// ─── Bootstrap wrapper ────────────────────────────────────────────────────────

interface SafeBootProps {
  children: ReactNode;
}

/**
 * SafeBoot — wraps the entire app.
 * 1. Installs global error handlers
 * 2. Wraps in BootErrorBoundary (catches render crashes)
 * 3. Never shows a white screen
 */
export function SafeBoot({ children }: SafeBootProps): React.JSX.Element {
  BootLog.step("SafeBoot mounted");

  return <BootErrorBoundary>{children}</BootErrorBoundary>;
}

