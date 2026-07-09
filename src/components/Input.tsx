import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps, Platform } from 'react-native';
import { theme } from '../theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
}

export function Input({ label, error, leftIcon, style, multiline, onFocus, onBlur, ...props }: InputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[
        styles.inputWrapper,
        multiline ? styles.inputWrapperMultiline : null,
        isFocused && !error ? styles.inputFocused : null,
        error ? styles.inputError : null,
      ]}>
        {leftIcon && <View style={[styles.iconContainer, multiline ? styles.iconContainerMultiline : null]}>{leftIcon}</View>}
        <TextInput
          style={[
            styles.input, 
            leftIcon ? styles.inputWithIcon : null, 
            multiline ? styles.inputMultiline : null, 
            style,
            Platform.OS === 'web' ? { outlineStyle: 'none' } as any : null
          ]}
          placeholderTextColor={theme.colors.textMuted}
          multiline={multiline}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing[4],
  },
  label: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing[2],
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    height: 48,
  },
  inputWrapperMultiline: {
    height: undefined,
    minHeight: 88,
    alignItems: 'flex-start',
  },
  inputFocused: {
    borderColor: theme.colors.borderFocus,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  iconContainer: {
    paddingLeft: theme.spacing[3],
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainerMultiline: {
    // Align the icon with the first line of text instead of the vertical center.
    paddingTop: 14,
  },
  input: {
    flex: 1,
    height: '100%',
    paddingHorizontal: theme.spacing[3],
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
  },
  inputMultiline: {
    height: undefined,
    minHeight: 88,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: 'top',
  },
  inputWithIcon: {
    paddingLeft: theme.spacing[2],
  },
  errorText: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.error,
    marginTop: theme.spacing[1],
  },
});
