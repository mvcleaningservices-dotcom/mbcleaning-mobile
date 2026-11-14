import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Linking, Platform, StyleProp, View, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { mapHtml } from './mapHtml';

export interface MapMarker {
  lat: number;
  lng: number;
  label: string;
  kind: 'home' | 'partner';
}
export interface LatLng {
  lat: number;
  lng: number;
}

// The page's "address" — OpenStreetMap expects map requests to say where they
// come from, so the web-view presents itself as our site.
const BASE_URL = 'https://www.mvcleaningservices.in/';

/**
 * OpenStreetMap map (client V2). Runs Leaflet inside the existing web-view
 * (react-native-webview — already used for Razorpay), so there is no Google
 * key and no new native map module. In the browser preview it uses an iframe.
 *
 * - `markers`: pins to show (home = red, partner = blue).
 * - `pickable` + `pin` + `onPick`: the customer places/drags their home pin.
 */
export function OsmMapView({
  markers,
  pickable = false,
  pin,
  onPick,
  onError,
  style,
}: {
  markers?: MapMarker[];
  pickable?: boolean;
  pin?: LatLng | null;
  onPick?: (p: LatLng) => void;
  onError?: (message: string) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const html = useMemo(() => mapHtml(pickable), [pickable]);
  const ready = useRef(false);
  const webRef = useRef<WebView>(null);
  const frameRef = useRef<any>(null);
  // The last pin the map itself reported — don't echo it back (no jump).
  const fromMap = useRef<string>('');
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const markersSig = JSON.stringify(markers ?? []);
  const pinSig = pin ? `${pin.lat},${pin.lng}` : '';

  const post = useCallback((msg: object) => {
    if (!ready.current) return;
    const s = JSON.stringify(msg);
    if (Platform.OS === 'web') frameRef.current?.contentWindow?.postMessage(s, '*');
    else webRef.current?.injectJavaScript(`window.__mv && window.__mv(${JSON.stringify(s)}); true;`);
  }, []);

  const pushState = useCallback(() => {
    if (markersSig !== '[]') post({ type: 'markers', markers: JSON.parse(markersSig) });
    if (pinSig && pinSig !== fromMap.current) {
      const [lat, lng] = pinSig.split(',').map(Number);
      post({ type: 'pin', lat, lng, zoom: 17 });
    }
  }, [markersSig, pinSig, post]);

  useEffect(() => { pushState(); }, [pushState]);

  const onMessage = useCallback((data: string) => {
    let m: any;
    try { m = JSON.parse(data); } catch { return; }
    if (m?.type === 'ready') {
      ready.current = true;
      pushState();
    } else if (m?.type === 'pick') {
      fromMap.current = `${m.lat},${m.lng}`;
      onPickRef.current?.({ lat: m.lat, lng: m.lng });
    } else if (m?.type === 'error') {
      onErrorRef.current?.(m.message);
    }
  }, [pushState]);

  // Browser preview: listen to the iframe.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const listener = (e: MessageEvent) => {
      if (e.source === frameRef.current?.contentWindow && typeof e.data === 'string') onMessage(e.data);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [onMessage]);

  if (Platform.OS === 'web') {
    return (
      <View style={[{ overflow: 'hidden' }, style]}>
        {React.createElement('iframe', {
          ref: frameRef,
          srcDoc: html,
          title: 'Map',
          style: { border: 0, width: '100%', height: '100%' },
        })}
      </View>
    );
  }

  return (
    <View style={[{ overflow: 'hidden' }, style]}>
      <WebView
        ref={webRef}
        source={{ html, baseUrl: BASE_URL }}
        originWhitelist={['*']}
        onMessage={(e) => onMessage(e.nativeEvent.data)}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        // The OSM credit link opens in the phone browser, not inside the map.
        onShouldStartLoadWithRequest={(r) => {
          if (r.url === BASE_URL || r.url.startsWith('about:') || r.url.startsWith('data:')) return true;
          if (/^https?:/.test(r.url)) void Linking.openURL(r.url).catch(() => {});
          return false;
        }}
        style={{ flex: 1, backgroundColor: 'transparent' }}
      />
    </View>
  );
}
