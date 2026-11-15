import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { theme } from '../theme';

/** The eye icon inside a password box — tap to show/hide the password. */
export function PasswordEye({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={{ padding: theme.spacing[2] }}
      accessibilityRole="button"
      accessibilityLabel={shown ? 'Hide password' : 'Show password'}
      accessibilityState={{ selected: shown }}
    >
      {shown ? <EyeOff size={20} color={theme.colors.textMuted} /> : <Eye size={20} color={theme.colors.textMuted} />}
    </TouchableOpacity>
  );
}
