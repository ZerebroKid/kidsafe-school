import React, {useRef, useState} from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {WebView as RNWebView, type WebViewProps} from 'react-native-webview';

import {colors, spacing} from '../../theme';
import type {StudyStackParamList} from '../../navigation/types';

// react-native-webview ships as a class component; the repo's React 18 type
// skew flags class/forwardRef components as invalid JSX (same issue that hits
// SafeAreaView / Stack.Navigator). Aliasing to a function-component type keeps
// prop typing while satisfying the JSX element-type constraint.
const WebView = RNWebView as unknown as React.ComponentType<WebViewProps>;

type Props = NativeStackScreenProps<StudyStackParamList, 'RewardWebView'>;

// Block anything that would leave the app for a native app / store. Plain
// http(s) navigation inside the reward site is allowed so games / articles
// work normally, but we never hand off to an external app.
const BLOCK_PATTERN =
  /^intent:|^market:|^vnd\.|play\.google\.com|^itms-|^tel:|^mailto:|^whatsapp:/i;

/**
 * P4.10.3 -- sandboxed in-app browser for non-YouTube reward links
 * (game_link / article_link). Keeps the child distraction-free: external
 * app/store hand-offs are blocked, popups are disabled.
 */
export function RewardWebViewScreen({route}: Props) {
  const {url} = route.params;
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const startUrl = useRef(url).current;

  if (!startUrl) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>This reward link is invalid.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        source={{uri: startUrl}}
        originWhitelist={['http://*', 'https://*']}
        setSupportMultipleWindows={false}
        javaScriptCanOpenWindowsAutomatically={false}
        onLoadEnd={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setFailed(true);
        }}
        onShouldStartLoadWithRequest={request => {
          const target = request?.url ?? '';
          if (BLOCK_PATTERN.test(target)) return false;
          return true;
        }}
        style={styles.webview}
      />
      {loading && !failed ? (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : null}
      {failed ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Could not open this reward.</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.bg},
  webview: {flex: 1, backgroundColor: colors.bg},
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  centered: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.bg,
  },
  errorText: {fontSize: 14, color: colors.textMuted},
});
