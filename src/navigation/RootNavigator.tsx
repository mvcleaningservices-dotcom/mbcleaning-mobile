import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { Home, ClipboardList, Wallet, User } from 'lucide-react-native';

import { theme } from '../theme';

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
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary600,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontFamily: theme.typography.fontFamily.medium,
          fontSize: 12,
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
  return (
    <NavigationContainer>
      {/* LoginScreen performs the auto-login check on mount and replaces to
          CustomerApp when a valid session exists; otherwise the Auth flow shows. */}
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Auth" component={AuthNavigator} />
        <Stack.Screen name="CustomerApp" component={CustomerTabs} />

        {/* Shared / deep screens */}
        <Stack.Screen name="Services" component={ServicesScreen} options={{ headerShown: true, title: 'Our Services' }} />
        <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ headerShown: true, title: 'Checkout' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
