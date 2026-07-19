import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, ClipboardList, Wallet, User } from 'lucide-react-native';

import { theme } from '../theme';
import { setUnauthorizedHandler } from '../api';
import { session } from '../session';
import { navigationRef, resetToAuth } from './navigationRef';

// Screens
import { LoginScreen } from '../screens/LoginScreen';
import { OtpScreen } from '../screens/OtpScreen';
import { CustomerHomeScreen } from '../screens/CustomerHomeScreen';
import { ServicesScreen } from '../screens/ServicesScreen';
import { CheckoutScreen } from '../screens/CheckoutScreen';
import { BookingsScreen } from '../screens/BookingsScreen';
import { WalletScreen } from '../screens/WalletScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

// MV Cleaning is a CONSUMER-ONLY app — there is no worker/vendor app by design
// (workers are managed by admins in the web dashboard). Do not add worker routes.
export type RootStackParamList = {
  Auth: undefined;
  CustomerApp: undefined;
  Services: undefined;
  // Screens use useNavigation<any>()/useRoute<any>(); params passed at runtime
  // (selectedServices, total). Kept loose here to avoid coupling the param list
  // to screen-level types.
  Checkout: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();
const AuthStack = createNativeStackNavigator();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Otp" component={OtpScreen} />
    </AuthStack.Navigator>
  );
}

function CustomerTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary600,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          // Grow the bar by the device's bottom inset (home indicator) so labels
          // never sit under it; keep a comfortable base height otherwise.
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontFamily: theme.typography.fontFamily.medium,
          fontSize: 12,
        },
        tabBarItemStyle: {
          paddingTop: 2,
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={CustomerHomeScreen}
        options={{ tabBarLabel: 'Home', tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }}
      />
      <Tab.Screen
        name="BookingsTab"
        component={BookingsScreen}
        options={{ tabBarLabel: 'Bookings', tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} /> }}
      />
      <Tab.Screen
        name="WalletTab"
        component={WalletScreen}
        options={{ tabBarLabel: 'Wallet', tabBarIcon: ({ color, size }) => <Wallet color={color} size={size} /> }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profile', tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  useEffect(() => {
    /* If the server ever rejects our token, drop the dead session and return to
       the auth flow. Registered here (not in api.ts) because only the navigation
       layer can route. */
    setUnauthorizedHandler(() => {
      void session.clear();
      resetToAuth();
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  return (
    <NavigationContainer ref={navigationRef}>
      {/* LoginScreen performs the auto-login check on mount and replaces to
          CustomerApp when a valid session exists; otherwise the Auth flow shows. */}
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Auth" component={AuthNavigator} />
        <Stack.Screen name="CustomerApp" component={CustomerTabs} />

        {/* Shared / deep screens. headerShown stays false (inherited): each of
            these draws its OWN header with a back button and title, so a stack
            header on top of it just repeats the title in a second bar. */}
        <Stack.Screen name="Services" component={ServicesScreen} />
        <Stack.Screen name="Checkout" component={CheckoutScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
