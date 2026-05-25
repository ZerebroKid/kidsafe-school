/**
 * ZKid app entry point.
 *
 * This is a placeholder until P1.3 migrates the v1 child onboarding wizard
 * into apps/kids/src/screens/child/. It exists so the RN runtime + NativeWind
 * pipeline is verifiable end-to-end:
 *
 * - "bg-brand" comes from tailwind.config.js extended palette
 * - "text-white", "text-xl", "p-4" are stock Tailwind utilities
 * - SafeAreaView lives inside react-native-safe-area-context (peer dep of NativeWind)
 */

import React from 'react';
import {StatusBar, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

export default function App(): React.JSX.Element {
  return (
    <SafeAreaView className="flex-1 bg-brand">
      <StatusBar barStyle="light-content" backgroundColor="#5B6CFF" />
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-3xl font-bold text-white">ZKid</Text>
        <Text className="mt-2 text-base text-white opacity-80">
          Placeholder — child onboarding wires in P1.3.1
        </Text>
      </View>
    </SafeAreaView>
  );
}
