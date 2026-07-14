import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useLocale } from '@/components/LocaleProvider';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class StartupErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    const report = `[STARTUP CRASH] ${error?.message || 'Unknown'}\nStack: ${error?.stack || ''}\nComponent: ${errorInfo.componentStack || ''}`;
    // eslint-disable-next-line no-console
    console.error(report);
  }

  render() {
    if (this.state.hasError) {
      return <StartupErrorView error={this.state.error} errorInfo={this.state.errorInfo} onReset={() => this.setState({ hasError: false, error: undefined, errorInfo: undefined })} />;
    }
    return this.props.children;
  }
}

function StartupErrorView({ error, errorInfo, onReset }: { error?: Error; errorInfo?: ErrorInfo; onReset: () => void }) {
  const { t } = useLocale();
  const router = useRouter();
  const handleGoHome = () => {
    onReset();
    router.replace("/(app)/(tabs)" as any);
  };
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t('error.startup_crash.title')}</Text>
        <Text style={styles.error}>{error?.message ?? t('error.startup_crash.unknown')}</Text>
        <Text style={styles.stack}>{error?.stack}</Text>
        <Text style={styles.stack}>{errorInfo?.componentStack}</Text>
      </ScrollView>
      <TouchableOpacity style={styles.resetBtn} onPress={handleGoHome}>
        <Text style={styles.resetBtnText}>{t('error.startup_crash.go_home')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0b0f', padding: 24 },
  scroll: { flexGrow: 1, justifyContent: 'center' },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 16 },
  error: { color: '#ff6b6b', fontSize: 14, marginBottom: 16 },
  stack: { color: '#aaa', fontSize: 11, fontFamily: Platform.select({ ios: 'Courier', android: 'monospace' }) },
  resetBtn: { backgroundColor: '#6c63ff', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  resetBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
