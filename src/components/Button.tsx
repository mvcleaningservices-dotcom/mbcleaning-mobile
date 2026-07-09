import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { theme } from '../theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({ 
  title, 
  onPress, 
  variant = 'primary', 
  size = 'md', 
  loading = false, 
  disabled = false,
  icon,
  style,
  textStyle
}: ButtonProps) {
  
  const getContainerStyle = () => {
    let base: ViewStyle = { ...styles.container, ...styles[`${size}Container`] };
    if (disabled) return { ...base, ...styles.disabledContainer };
    return { ...base, ...styles[`${variant}Container`] };
  };

  const getTextStyle = () => {
    let base: TextStyle = { ...styles.text, ...styles[`${size}Text`] };
    if (disabled) return { ...base, ...styles.disabledText };
    return { ...base, ...styles[`${variant}Text`] };
  };

  return (
    <TouchableOpacity 
      style={[getContainerStyle(), style]} 
      onPress={onPress} 
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? '#fff' : theme.colors.primary600} />
      ) : (
        <>
          {icon && icon}
          <Text style={[getTextStyle(), textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    gap: theme.spacing[2],
  },
  smContainer: { paddingVertical: theme.spacing[2], paddingHorizontal: theme.spacing[3] },
  mdContainer: { paddingVertical: 12, paddingHorizontal: theme.spacing[5] },
  lgContainer: { paddingVertical: 16, paddingHorizontal: theme.spacing[6] },
  
  primaryContainer: { backgroundColor: theme.colors.primary600 },
  secondaryContainer: { backgroundColor: theme.colors.primary50, borderWidth: 1, borderColor: theme.colors.primary100 },
  ghostContainer: { backgroundColor: 'transparent' },
  dangerContainer: { backgroundColor: theme.colors.error },
  disabledContainer: { backgroundColor: theme.colors.surfaceMuted, borderWidth: 1, borderColor: theme.colors.border },

  text: { fontFamily: theme.typography.fontFamily.semiBold, textAlign: 'center' },
  smText: { fontSize: theme.typography.sizes.sm },
  mdText: { fontSize: theme.typography.sizes.md },
  lgText: { fontSize: theme.typography.sizes.lg },
  
  primaryText: { color: theme.colors.textInverse },
  secondaryText: { color: theme.colors.primary700 },
  ghostText: { color: theme.colors.textSecondary },
  dangerText: { color: theme.colors.textInverse },
  disabledText: { color: theme.colors.textMuted },
});
