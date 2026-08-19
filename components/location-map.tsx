import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

type LocationMapProps = {
  initialLatitude: number;
  initialLongitude: number;
  onMove: (coords: { latitude: number; longitude: number }) => void;
};

export function LocationMap({ initialLatitude, initialLongitude, onMove }: LocationMapProps) {
  const html = useMemo(
    () => `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body, #map { height: 100%; margin: 0; padding: 0; }
      .leaflet-control-attribution { font-size: 10px; }
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
      const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
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
    [initialLatitude, initialLongitude]
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
    <View style={styles.wrap}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={styles.map}
        onMessage={onMessage}
        javaScriptEnabled
        scrollEnabled={false}
      />
      <Text style={styles.hint}>Drag the pin or tap the map to set the inspection location</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 250, marginTop: 25, overflow: 'hidden', borderRadius: 16 },
  map: { flex: 1, backgroundColor: '#DDECEE' },
  hint: {
    backgroundColor: 'rgba(22, 58, 74, 0.82)',
    bottom: 0,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    left: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: 'absolute',
    right: 0,
  },
});
