/**
 * ZConnect app entry point.
 *
 * Placeholder until P1.4 migrates the v1 parent dashboard (map, child
 * details, tabs) into apps/guardian/src/screens/parent/. Used to verify
 * NativeWind pipeline end-to-end on this app.
 */

import React from 'react';
import {StatusBar, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

export default function App(): React.JSX.Element {
  return (
    <SafeAreaView className="flex-1 bg-brand">
      <StatusBar barStyle="light-content" backgroundColor="#5B6CFF" />
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-3xl font-bold text-white">ZConnect</Text>
        <Text className="mt-2 text-base text-white opacity-80">
          Placeholder — parent dashboard wires in P1.4.1
        </Text>
      </View>
    </SafeAreaView>
  );
}
