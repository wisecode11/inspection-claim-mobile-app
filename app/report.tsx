import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useInspection } from '@/context/inspection-context';
import { loadLastPdf, saveLastPdf } from '@/lib/last-pdf';
import {
  createInspectionPdf,
  downloadInspectionPdf,
  shareInspectionPdf,
  viewInspectionPdf,
} from '@/utils/create-inspection-pdf';

export default function ReportScreen() {
  const router = useRouter();
  const { data, clearInspectionDraft } = useInspection();
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const uri = await createInspectionPdf(data);
        if (!active) return;
        setPdfUri(uri);
        if (data.jobId) {
          await saveLastPdf(data.jobId, uri);
        }
      } catch {
        // If generation fails after an Android remount, try the last saved PDF.
        const existing = data.jobId ? await loadLastPdf(data.jobId) : null;
        if (active && existing) {
          setPdfUri(existing);
        } else if (active) {
          Alert.alert('PDF error', 'Could not generate the Evidence Package PDF.');
        }
      } finally {
        if (active) setCreating(false);
      }
    })();

    return () => {
      active = false;
    };
    // Generate once when this screen opens, using the current inspection snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runAction = async (action: 'view' | 'download' | 'share') => {
    if (!pdfUri || busy) return;

    try {
      setBusy(true);

      if (action === 'view') {
        await viewInspectionPdf(pdfUri);
        return;
      }

      if (action === 'download') {
        const message = await downloadInspectionPdf(pdfUri);
        Alert.alert('Downloaded', message);
        return;
      }

      await shareInspectionPdf(pdfUri);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      Alert.alert('Action failed', message);
    } finally {
      setBusy(false);
    }
  };

  const backToJobs = async () => {
    try {
      await clearInspectionDraft();
    } catch {
      // ignore
    }
    router.replace('/jobs');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.success}>
          {creating ? (
            <ActivityIndicator color="#3C8C5A" size="large" />
          ) : (
            <Text style={styles.successMark}>✓</Text>
          )}
        </View>

        <Text style={styles.title}>
          {creating ? 'Building Evidence Package…' : 'Evidence Package Ready'}
        </Text>
        <Text style={styles.subtitle}>
          {creating
            ? 'Organizing photos and setup data into the final PDF.'
            : 'Open the PDF in your device viewer, or download / share it.'}
        </Text>

        <View style={styles.reportCard}>
          <Text style={styles.reportLabel}>EVIDENCE PACKAGE</Text>
          <Text style={styles.customer}>{data.homeownerName || data.customer}</Text>
          <Text style={styles.address}>{data.address}</Text>
          <Text style={styles.meta}>
            {pdfUri
              ? `${data.photos.length} photos · empty sections omitted`
              : 'Preparing PDF...'}
          </Text>
        </View>

        <Pressable
          style={[styles.primary, (!pdfUri || busy) && styles.disabled]}
          disabled={!pdfUri || busy}
          onPress={() => void runAction('view')}
        >
          <Text style={styles.primaryText}>{busy ? 'Please wait...' : 'Open PDF'}</Text>
        </Pressable>

        <Pressable
          style={[styles.secondary, (!pdfUri || busy) && styles.disabled]}
          disabled={!pdfUri || busy}
          onPress={() => void runAction('download')}
        >
          <Text style={styles.secondaryText}>Download PDF</Text>
        </Pressable>

        <Pressable
          style={[styles.link, (!pdfUri || busy) && styles.disabled]}
          disabled={!pdfUri || busy}
          onPress={() => void runAction('share')}
        >
          <Text style={styles.linkText}>Share Report</Text>
        </Pressable>

        <Pressable style={styles.done} onPress={() => void backToJobs()}>
          <Text style={styles.doneText}>Back to Jobs</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F7F8' },
  content: { alignItems: 'center', flex: 1, padding: 24 },
  success: {
    alignItems: 'center',
    backgroundColor: '#E5F3EB',
    borderRadius: 40,
    height: 80,
    justifyContent: 'center',
    marginTop: 36,
    width: 80,
  },
  successMark: { color: '#3C8C5A', fontSize: 42, fontWeight: '800' },
  title: { color: '#163A4A', fontSize: 24, fontWeight: '800', marginTop: 18, textAlign: 'center' },
  subtitle: { color: '#70818A', marginTop: 7, textAlign: 'center' },
  reportCard: { backgroundColor: '#FFF', borderRadius: 16, marginTop: 28, padding: 20, width: '100%' },
  reportLabel: { color: '#E17035', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  customer: { color: '#163A4A', fontSize: 20, fontWeight: '800', marginTop: 10 },
  address: { color: '#526A74', lineHeight: 20, marginTop: 4 },
  meta: { color: '#84949C', fontSize: 12, marginTop: 18 },
  primary: {
    alignItems: 'center',
    backgroundColor: '#E17035',
    borderRadius: 12,
    marginTop: 24,
    padding: 16,
    width: '100%',
  },
  primaryText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  secondary: {
    alignItems: 'center',
    borderColor: '#163A4A',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
    padding: 15,
    width: '100%',
  },
  secondaryText: { color: '#163A4A', fontWeight: '800' },
  link: { marginTop: 18 },
  linkText: { color: '#E17035', fontWeight: '800' },
  done: { marginTop: 'auto', padding: 15 },
  doneText: { color: '#70818A', fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
