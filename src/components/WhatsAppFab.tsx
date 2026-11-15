import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { WhatsAppIcon } from './WhatsAppIcon';
import { openWhatsApp } from '../content/useContent';

/**
 * Small floating WhatsApp button, bottom-right (same as the website).
 * `raised` lifts it above the cart bar so it never covers "Continue".
 */
export function WhatsAppFab({ raised = false }: { raised?: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.fab, { bottom: raised ? 92 : 16 }]}
      onPress={openWhatsApp}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Chat with us on WhatsApp"
    >
      <WhatsAppIcon size={26} color="#fff" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    zIndex: 20,
  },
});
