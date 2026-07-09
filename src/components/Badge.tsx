import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';

interface BadgeProps {
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

export function Badge({ label, variant = 'default' }: BadgeProps) {
  const getContainerStyle = () => {
    switch (variant) {
      case 'success': return { backgroundColor: theme.colors.successBg };
      case 'warning': return { backgroundColor: theme.colors.warningBg };
      case 'error': return { backgroundColor: theme.colors.errorBg };
      case 'info': return { backgroundColor: theme.colors.infoBg };
      default: return { backgroundColor: theme.colors.surfaceMuted };
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'success': return { color: theme.colors.success };
      case 'warning': return { color: '#b45309' }; // darker warning text for contrast
      case 'error': return { color: theme.colors.error };
      case 'info': return { color: theme.colors.info };
      default: return { color: theme.colors.textSecondary };
    }
  };

  return (
    <View style={[styles.container, getContainerStyle()]}>
      <Text style={[styles.text, getTextStyle()]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing[2],
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: theme.typography.fontFamily.semiBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
