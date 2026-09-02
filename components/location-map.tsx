import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

import { Brand } from '@/constants/theme';

type LocationMapProps = {
  initialLatitude: number;
  initialLongitude: number;
  embedded?: boolean;
  onMove: (coords: { latitude: number; longitude: number }) => void;
};

export function LocationMap({ initialLatitude, initialLongitude, embedded = false, onMove }: LocationMapProps) {
  const html = useMemo(
    () => `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body, #map { height: 100%; margin: 0; padding: 0; }
      .leaflet-control-attribution { font-size: 9px; opacity: 0.7; }
      .leaflet-control-zoom { border: none !important; box-shadow: 0 1px 4px rgba(0,0,0,0.12) !important; }
      .leaflet-control-zoom a {
        background: #fff !important;
        color: #133A42 !important;
        border: none !important;
        font-size: 16px !important;
        height: 30px !important;
        line-height: 30px !important;
        width: 30px !important;
      }
      .custom-pin {
        background: transparent;
        border: none;
      }
      .pin-body {
        background: ${Brand.accent};
        border: 3px solid #fff;
        border-radius: 50% 50% 50% 0;
        box-shadow: 0 2px 8px rgba(0,0,0,0.28);
        height: 30px;
        margin-left: -15px;
        margin-top: -30px;
        position: relative;
        transform: rotate(-45deg);
        width: 30px;
      }
      .pin-dot {
        background: #fff;
        border-radius: 50%;
        height: 8px;
        left: 50%;
        margin: -4px 0 0 -4px;
        position: absolute;
        top: 50%;
        width: 8px;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      const lat = ${Number(initialLatitude)};
      const lng = ${Number(initialLongitude)};
      const map = L.map('map', { zoomControl: true }).setView([lat, lng], 17);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);
      const pinIcon = L.divIcon({
        className: 'custom-pin',
        html: '<div class="pin-body"><div class="pin-dot"></div></div>',
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      });
      const marker = L.marker([lat, lng], { draggable: true, icon: pinIcon }).addTo(map);
      function send(nextLat, nextLng) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            latitude: nextLat,
            longitude: nextLng
          }));
        }
      }
      marker.on('dragend', function () {
        const pos = marker.getLatLng();
        send(pos.lat, pos.lng);
      });
      map.on('click', function (event) {
        marker.setLatLng(event.latlng);
        send(event.latlng.lat, event.latlng.lng);
      });
    </script>
  </body>
</html>`,
    [initialLatitude, initialLongitude],
  );

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data) as { latitude?: number; longitude?: number };
      if (typeof payload.latitude === 'number' && typeof payload.longitude === 'number') {
        onMove({ latitude: payload.latitude, longitude: payload.longitude });
      }
    } catch {
      // ignore malformed map messages
    }
  };

  return (
    <View style={[styles.wrap, embedded && styles.wrapEmbedded]}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={styles.map}
        onMessage={onMessage}
        javaScriptEnabled
        scrollEnabled={false}
      />
      {embedded ? (
        <View pointerEvents="none" style={styles.hintPill}>
          <Ionicons color="#FFFFFF" name="hand-left-outline" size={13} />
          <Text style={styles.hintText}>Drag pin to adjust location</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderColor: '#D8E0E4',
    borderRadius: 18,
    borderWidth: 1,
    height: 290,
    marginBottom: 4,
    overflow: 'hidden',
    shadowColor: '#133A42',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
  },
  wrapEmbedded: {
    borderRadius: 0,
    borderWidth: 0,
    height: 268,
    marginBottom: 0,
    shadowOpacity: 0,
  },
  map: { flex: 1, backgroundColor: '#DDECEE' },
  hintPill: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(51, 51, 51, 0.92)',
    borderRadius: 999,
    bottom: 12,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    position: 'absolute',
  },
  hintText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
});
