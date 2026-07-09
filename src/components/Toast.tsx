import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle2, XCircle, Info } from 'lucide-react-native';
import { theme } from '../theme';

type ToastType = 'success' | 'error' | 'info';
interface ToastState { message: string; type: ToastType; }

interface ToastApi {
  show: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** App-wide toast. Wrap the app once in <ToastProvider>; call useToast() anywhere. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-16)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -16, duration: 180, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [opacity, translateY]);

  const show = useCallback((message: string, type: ToastType = 'info') => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setToast({ message, type });
    opacity.setValue(0);
    translateY.setValue(-16);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 8 }),
    ]).start();
    hideTimer.current = setTimeout(hide, 3000);
  }, [opacity, translateY, hide]);

  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

  const api: ToastApi = {
    show,
    success: (m) => show(m, 'success'),
    error: (m) => show(m, 'error'),
  };

  const accent =
    toast?.type === 'success' ? theme.colors.success
    : toast?.type === 'error' ? theme.colors.error
    : theme.colors.primary600;

  const Icon = toast?.type === 'success' ? CheckCircle2 : toast?.type === 'error' ? XCircle : Info;

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast && (
        <SafeAreaView pointerEvents="none" style={styles.safe} edges={['top']}>
          <Animated.View style={[styles.toast, { opacity, transform: [{ translateY }], borderLeftColor: accent }]}>
            <Icon size={20} color={accent} />
            <Text style={styles.text} numberOfLines={2}>{toast.message}</Text>
          </Animated.View>
        </SafeAreaView>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

const styles = StyleSheet.create({
  safe: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', zIndex: 1000 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    marginTop: theme.spacing[2],
    marginHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    paddingHorizontal: theme.spacing[4],
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderLeftWidth: 4,
    maxWidth: 480,
    width: '92%',
    ...theme.shadows.lg,
  },
  text: { flex: 1, fontFamily: theme.typography.fontFamily.medium, fontSize: theme.typography.sizes.sm, color: theme.colors.textPrimary },
});
