import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { Brand } from '@/constants/theme';

const PDFJS_VERSION = '3.11.174';
const PDFJS_BASE = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

/** Android's WebView can't render PDFs, so pages are drawn to canvases with pdf.js. */
function pdfJsHtml(base64: string) {
  return `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=4" />
<style>
  html, body { margin: 0; padding: 0; background: #E9EEF0; }
  #pages { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 10px 0; }
  canvas { width: calc(100% - 16px); height: auto; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.18); }
</style>
<script src="${PDFJS_BASE}/pdf.min.js"></script>
</head>
<body>
<div id="pages"></div>
<script>
  function post(type, message) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, message: message || '' }));
  }
  (async function () {
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '${PDFJS_BASE}/pdf.worker.min.js';
      var raw = atob('${base64}');
      var bytes = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      var pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
      var container = document.getElementById('pages');
      var ratio = Math.min(window.devicePixelRatio || 1, 2);
      for (var n = 1; n <= pdf.numPages; n++) {
        var page = await pdf.getPage(n);
        var base = page.getViewport({ scale: 1 });
        var scale = ((window.innerWidth - 16) / base.width) * ratio;
        var viewport = page.getViewport({ scale: scale });
        var canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        container.appendChild(canvas);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;
        if (n === 1) post('loaded');
      }
    } catch (error) {
      post('error', String(error && error.message || error));
    }
  })();
</script>
</body>
</html>`;
}

/** Shows a local PDF file inside the screen. */
export function PdfPreview({ uri, style }: { uri: string; style?: ViewStyle }) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    if (Platform.OS !== 'android') return;

    let active = true;
    FileSystem.readAsStringAsync(uri, { encoding: 'base64' })
      .then((base64) => {
        if (active) setHtml(pdfJsHtml(base64));
      })
      .catch(() => {
        if (active) setError('Could not read the PDF file.');
      });
    return () => {
      active = false;
    };
  }, [uri]);

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data) as { type: string; message?: string };
      if (payload.type === 'loaded') setLoading(false);
      if (payload.type === 'error') {
        setLoading(false);
        setError('Could not display the PDF here. Use "Open" to view it.');
      }
    } catch {
      // Ignore unrelated messages.
    }
  };

  const directory = uri.slice(0, uri.lastIndexOf('/') + 1);

  return (
    <View style={[styles.frame, style]}>
      {error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : Platform.OS === 'android' ? (
        html ? (
          <WebView
            javaScriptEnabled
            onMessage={onMessage}
            originWhitelist={['*']}
            source={{ html, baseUrl: 'https://localhost/' }}
            style={styles.webview}
          />
        ) : null
      ) : (
        <WebView
          allowFileAccess
          allowingReadAccessToURL={directory}
          onError={() => setError('Could not display the PDF here. Use "Open" to view it.')}
          onLoadEnd={() => setLoading(false)}
          originWhitelist={['*']}
          source={{ uri }}
          style={styles.webview}
        />
      )}

      {loading && !error ? (
        <View style={[StyleSheet.absoluteFill, styles.center, styles.loading]}>
          <ActivityIndicator color={Brand.accent} />
          <Text style={styles.loadingText}>Loading PDF…</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: '#E9EEF0',
    borderColor: Brand.border,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  webview: {
    backgroundColor: '#E9EEF0',
    flex: 1,
  },
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  loading: {
    backgroundColor: '#E9EEF0',
  },
  loadingText: {
    color: Brand.muted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
  },
  errorText: {
    color: Brand.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
