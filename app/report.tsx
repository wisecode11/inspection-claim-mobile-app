import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Screen } from '@/components/inspection-ui';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useInspection } from '@/context/inspection-context';
import {
  fetchJob,
  fetchPropertyMapPair,
  fetchSwathBaseMap,
  fetchReportLanguage,
  fetchWeatherVerification,
  jobDateOfLoss,
  sendEvidenceToAdmin,
  verifyWeatherForJob,
} from '@/lib/api';
import { loadLastPdf, saveLastPdf } from '@/lib/last-pdf';
import type { ReportLanguagePackage } from '@/lib/report-templates';
import {
  createInspectionPdf,
  downloadInspectionPdf,
  shareInspectionPdf,
  viewInspectionPdf,
} from '@/utils/create-inspection-pdf';

export default function ReportScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { data, update, clearInspectionDraft } = useInspection();
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const includedPhotos = data.photos.filter((photo) => photo.includeInReport !== false).length;

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        let snapshot = data;

        if (token && data.jobId) {
          try {
            const job = await fetchJob(token, data.jobId);
            const weather =
              (await fetchWeatherVerification(token, data.jobId).catch(() => null)) ||
              (await verifyWeatherForJob(token, data.jobId).catch(() => null));

            const enriched = {
              ...data,
              claimNumber: job.claim?.claimNumber || data.claimNumber,
              policyNumber: job.claim?.policyNumber || data.policyNumber,
              dateOfLoss: jobDateOfLoss(job) || data.dateOfLoss,
              jobStatus: job.status || data.jobStatus,
              weatherSummary: weather?.summary || data.weatherSummary,
              // Keep evidence paired with the summary it came from.
              weatherEvidence: weather ? weather.evidence ?? null : data.weatherEvidence ?? null,
              weatherMatchStatus: weather?.matchStatus || data.weatherMatchStatus,
              weatherStatus: weather?.summary?.badgeTitle || data.weatherStatus,
            };
            update(enriched);
            snapshot = enriched;
          } catch {
            // Offline — generate from local draft.
          }
        }

        let language: ReportLanguagePackage | null = null;
        let maps: { roadmap: string | null; satellite: string | null } | null = null;
        if (token) {
          language = await fetchReportLanguage(token).catch(() => null);
          if (
            typeof snapshot.latitude === 'number' &&
            typeof snapshot.longitude === 'number' &&
            Number.isFinite(snapshot.latitude) &&
            Number.isFinite(snapshot.longitude)
          ) {
            maps = await fetchPropertyMapPair(token, {
              latitude: snapshot.latitude,
              longitude: snapshot.longitude,
            }).catch(() => null);
          }
        }

        // Base imagery for the hail swath map; without it the swath draws on a plain background.
        const swathBounds = snapshot.weatherEvidence?.swath?.bounds;
        const swathBaseMap =
          token && swathBounds ? await fetchSwathBaseMap(token, swathBounds).catch(() => null) : null;

        const uri = await createInspectionPdf(snapshot, language, maps, swathBaseMap);
        if (!active) return;
        setPdfUri(uri);
        if (data.jobId) {
          await saveLastPdf(data.jobId, uri);
        }
      } catch {
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
    // Final PDF is generated from the edited draft when this screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runAction = async (action: 'view' | 'download' | 'share') => {
    if (!pdfUri || busy || sending) return;

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

  const sendToAdmin = async () => {
    if (!pdfUri || !token || sending || sent) return;

    try {
      setSending(true);
      const result = await sendEvidenceToAdmin({
        token,
        data,
        pdfUri,
      });
      setSent(true);
      // Resent after a rejection: the admin's old reason no longer applies.
      update({ jobStatus: result.job?.status || data.jobStatus, review: null });
      Alert.alert(
        'Sent to Admin',
        result.alreadySubmitted
          ? 'Package updated on the server for admin review.'
          : `Evidence package submitted${
              result.photosUploaded != null ? ` (${result.photosUploaded} photos)` : ''
            }. Admin can review it under Reports.`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      Alert.alert('Send failed', message);
    } finally {
      setSending(false);
    }
  };

  const backToJobs = async () => {
    try {
      await clearInspectionDraft();
    } catch {
      // ignore
    }
    router.replace('/(tabs)/jobs');
  };

  const actionsDisabled = !pdfUri || busy || sending || creating;

  return (
    <Screen edges={['bottom']} style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.success}>
          {creating ? (
            <ActivityIndicator color="#3C8C5A" size="large" />
          ) : (
            <Text style={styles.successMark}>✓</Text>
          )}
        </View>

        <Text style={styles.title}>
          {creating ? 'Building Final PDF…' : 'Final Evidence Package Ready'}
        </Text>
        <Text style={styles.subtitle}>
          {creating
            ? 'Applying your draft edits into the final PDF.'
            : 'Open the PDF, or go back to edit the draft before sending.'}
        </Text>

        <View style={styles.reportCard}>
          <View style={styles.reportCardBody}>
            <Text style={styles.reportLabel}>FINAL PDF</Text>
            <Text style={styles.customer}>{data.homeownerName || data.customer}</Text>
            <Text style={styles.address}>{data.address}</Text>
            <Text style={styles.meta}>
              {pdfUri
                ? `${includedPhotos} photos included · draft applied`
                : 'Preparing PDF...'}
            </Text>
          </View>

          <View style={styles.cardActions}>
            <Pressable
              accessibilityRole="button"
              disabled={actionsDisabled}
              onPress={() => void runAction('view')}
              style={({ pressed }) => [
                styles.cardAction,
                actionsDisabled && styles.disabled,
                pressed && !actionsDisabled && styles.pressed,
              ]}
            >
              <Text style={styles.cardActionText}>{busy ? '…' : 'Open'}</Text>
            </Pressable>

            <View style={styles.cardActionDivider} />

            <Pressable
              accessibilityRole="button"
              disabled={actionsDisabled}
              onPress={() => void runAction('download')}
              style={({ pressed }) => [
                styles.cardAction,
                actionsDisabled && styles.disabled,
                pressed && !actionsDisabled && styles.pressed,
              ]}
            >
              <Text style={styles.cardActionText}>Download</Text>
            </Pressable>

            <View style={styles.cardActionDivider} />

            <Pressable
              accessibilityRole="button"
              disabled={actionsDisabled}
              onPress={() => void runAction('share')}
              style={({ pressed }) => [
                styles.cardAction,
                actionsDisabled && styles.disabled,
                pressed && !actionsDisabled && styles.pressed,
              ]}
            >
              <Text style={styles.cardActionText}>Share</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.bottomActions}>
          <Pressable
            style={[
              styles.send,
              (!pdfUri || !token || sending || sent || creating) && styles.disabled,
            ]}
            disabled={!pdfUri || !token || sending || sent || creating}
            onPress={() => void sendToAdmin()}
          >
            {sending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.sendText}>
                {sent ? 'Sent to Admin ✓' : 'Send to Admin'}
              </Text>
            )}
          </Pressable>

          <View style={styles.footerLinks}>
            <Pressable
              disabled={busy || sending || creating}
              onPress={() => router.replace('/report-draft')}
              style={({ pressed }) => [
                styles.footerLink,
                (busy || sending || creating) && styles.disabled,
                pressed && !(busy || sending || creating) && styles.pressed,
              ]}
            >
              <Text style={styles.editDraftText}>Edit draft again</Text>
            </Pressable>

            <Pressable
              onPress={() => void backToJobs()}
              style={({ pressed }) => [styles.footerLink, pressed && styles.pressed]}
            >
              <Text style={styles.doneText}>Back to Jobs</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Screen>
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
  title: { color: '#133A42', fontSize: 24, fontWeight: '800', marginTop: 18, textAlign: 'center' },
  subtitle: { color: '#70818A', marginTop: 7, textAlign: 'center' },
  reportCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginTop: 28,
    overflow: 'hidden',
    width: '100%',
  },
  reportCardBody: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  reportLabel: { color: '#84949C', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  customer: { color: '#133A42', fontSize: 20, fontWeight: '800', marginTop: 10 },
  address: { color: '#526A74', lineHeight: 20, marginTop: 4 },
  meta: { color: '#84949C', fontSize: 12, marginTop: 14 },
  cardActions: {
    borderTopColor: '#E8EEF0',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 48,
  },
  cardAction: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  cardActionDivider: {
    alignSelf: 'stretch',
    backgroundColor: '#E8EEF0',
    marginVertical: 10,
    width: StyleSheet.hairlineWidth,
  },
  cardActionText: {
    color: Brand.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  send: {
    alignItems: 'center',
    backgroundColor: Brand.accent,
    borderRadius: Brand.buttonRadiusLg,
    minHeight: 54,
    paddingHorizontal: 16,
    paddingVertical: 16,
    width: '100%',
  },
  sendText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  bottomActions: {
    marginTop: 'auto',
    paddingTop: 24,
    width: '100%',
  },
  footerLinks: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 16,
    width: '100%',
  },
  footerLink: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: 12,
  },
  editDraftText: {
    color: '#133A42',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  doneText: {
    color: '#70818A',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.75 },
});
