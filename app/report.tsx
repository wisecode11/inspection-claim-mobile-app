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

import { ConfirmModal } from '@/components/confirm-modal';
import { Screen } from '@/components/inspection-ui';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useInspection } from '@/context/inspection-context';
import {
  type AuthCompany,
  type AuthUser,
  fetchJob,
  fetchMySession,
  fetchPropertyMapPair,
  fetchSwathBaseMap,
  fetchReportLanguage,
  fetchWeatherVerification,
  jobDateOfLoss,
  sendEvidenceToAdmin,
  verifyWeatherForJob,
} from '@/lib/api';
import { companyDisplayName } from '@/lib/auth-storage';
import type { InspectionData } from '@/lib/inspection-types';
import { opensStatusScreen, reviewStateForJob } from '@/lib/job-review';
import { loadLastPdf, saveLastPdf } from '@/lib/last-pdf';
import type { ReportLanguagePackage } from '@/lib/report-templates';
import {
  createInspectionPdf,
  pdfIsMissingPhotos,
  downloadInspectionPdf,
  shareInspectionPdf,
  viewInspectionPdf,
} from '@/utils/create-inspection-pdf';

/** Inspector contact, credentials and company name for the PDF. */
function inspectorPdfDetails(
  user: AuthUser | null,
  company: AuthCompany | null,
): Partial<InspectionData> {
  return {
    inspectorEmail: user?.email || '',
    inspectorPhone: user?.profile?.phone || '',
    inspectorLicenseNumber: user?.profile?.licenseNumber || '',
    inspectorCertifications: user?.profile?.certifications || [],
    companyName: companyDisplayName(company),
  };
}

/** Offline fallback: job statuses that mean the package is already with the admin. */
function lockForStatus(jobStatus: string): 'pending' | 'approved' | null {
  const key = (jobStatus || '').toLowerCase();
  if (key === 'completed') return 'approved';
  return opensStatusScreen(key) ? 'pending' : null;
}

export default function ReportScreen() {
  const router = useRouter();
  const { token, user, company, updateUser } = useAuth();
  const { data, update, clearInspectionDraft } = useInspection();
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  /** Set when the PDF is missing photos or is an older copy; shown and confirmed before sending. */
  const [pdfWarning, setPdfWarning] = useState<string | null>(null);
  /**
   * Why sending is not allowed right now: the package is already with the admin ('pending')
   * or approved. Null = first send, or a resend after the admin rejected / requested changes.
   * Seeded from the local draft, then refreshed from the server job when online.
   */
  const [sendLock, setSendLock] = useState<'pending' | 'approved' | null>(() =>
    data.review ? null : lockForStatus(data.jobStatus),
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const resend = Boolean(data.review);

  const includedPhotos = data.photos.filter((photo) => photo.includeInReport !== false).length;

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        let snapshot = data;

        if (token && data.jobId) {
          try {
            const job = await fetchJob(token, data.jobId);
            // Server truth: already with the admin / approved → locked; rejected or changes
            // requested → resend allowed.
            const review = reviewStateForJob(job);
            if (active) {
              setSendLock(review === 'pending' ? 'pending' : review === 'approved' ? 'approved' : null);
            }
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

        // Inspector + company blocks come from the signed-in profile, never the job's customer.
        let profileUser = user;
        let profileCompany = company;
        if (token) {
          const fresh = await fetchMySession(token).catch(() => null);
          if (fresh) {
            profileUser = fresh.user;
            profileCompany = fresh.company ?? company;
            void updateUser(fresh.user).catch(() => undefined);
          }
        }
        const inspectorDetails = inspectorPdfDetails(profileUser, profileCompany);
        snapshot = { ...snapshot, ...inspectorDetails };
        update(inspectorDetails);

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

        const result = await createInspectionPdf(snapshot, language, maps, swathBaseMap);
        if (!active) return;
        setPdfUri(result.uri);
        if (pdfIsMissingPhotos(result)) {
          const warning =
            result.quality === 'none'
              ? `The PDF could not include photos. All ${result.totalPhotos} photos are still uploaded with the job, but the PDF only lists them.`
              : `${result.totalPhotos - result.embeddedPhotos} of ${result.totalPhotos} photos could not be added to the PDF. They are marked in the PDF and still uploaded with the job.`;
          setPdfWarning(warning);
          Alert.alert(
            'Photos missing from the PDF',
            `${warning}\n\nTry removing very large or damaged photos in the draft, then rebuild.`
          );
        }
        if (data.jobId) {
          await saveLastPdf(data.jobId, result.uri);
        }
      } catch {
        const existing = data.jobId ? await loadLastPdf(data.jobId) : null;
        if (active && existing) {
          // Not silent: this older PDF may not include the latest edits or photos.
          setPdfUri(existing);
          setPdfWarning(
            'This is the last PDF built for this job. A new one could not be created, so recent edits or photos may be missing.'
          );
          Alert.alert(
            'Showing an older PDF',
            'A new PDF could not be created. The last PDF for this job is shown instead and may be out of date.'
          );
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

  /** Button press: always confirm first (in a modal). */
  const requestSend = () => {
    if (!pdfUri || !token || sending || sent || sendLock) return;
    setConfirmOpen(true);
  };

  const sendToAdmin = async () => {
    if (!pdfUri || !token || sending || sent || sendLock) return;

    try {
      setSending(true);
      const result = await sendEvidenceToAdmin({
        token,
        data,
        pdfUri,
      });
      setSent(true);
      setSendLock('pending');
      // Resent after a rejection: the admin's old reason no longer applies.
      update({ jobStatus: result.job?.status || data.jobStatus, review: null });
      setConfirmOpen(false);
      setSuccessMessage(
        `Your evidence package${
          result.photosUploaded != null ? ` with ${result.photosUploaded} photos` : ''
        } is with the admin for review. You can send again only if the admin rejects it or requests changes.`
      );
    } catch (error) {
      setConfirmOpen(false);
      const message = error instanceof Error ? error.message : 'Please try again.';
      // The server refuses a second send while the admin still has the package.
      if (/already (sent|approved)/i.test(message)) {
        setSendLock(/approved/i.test(message) ? 'approved' : 'pending');
      }
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
  const sendDisabled = !pdfUri || !token || sending || sent || creating || Boolean(sendLock);
  const sendLabel = sent
    ? 'Sent to Admin ✓'
    : sendLock === 'approved'
      ? 'Approved by admin'
      : sendLock === 'pending'
        ? 'Sent · awaiting admin review'
        : resend
          ? 'Resend to Admin'
          : 'Send to Admin';

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
            {pdfWarning ? (
              <View style={styles.warning} accessibilityRole="alert">
                <Text style={styles.warningTitle}>Incomplete PDF</Text>
                <Text style={styles.warningText}>{pdfWarning}</Text>
              </View>
            ) : null}
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
            accessibilityRole="button"
            style={[styles.send, sendDisabled && styles.disabled]}
            disabled={sendDisabled}
            onPress={requestSend}
          >
            {sending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.sendText}>{sendLabel}</Text>
            )}
          </Pressable>
          {sendLock && !sent ? (
            <Text style={styles.lockNote}>
              {sendLock === 'approved'
                ? 'The admin approved this package. Nothing more to send.'
                : 'Already sent. You can send again only if the admin rejects it or requests changes.'}
            </Text>
          ) : null}

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

      <ConfirmModal
        visible={confirmOpen}
        icon={pdfWarning ? 'alert-circle-outline' : 'document-text-outline'}
        danger={Boolean(pdfWarning)}
        title={pdfWarning ? 'Send an incomplete PDF?' : resend ? 'Resend to admin?' : 'Send to admin?'}
        message={
          pdfWarning
            ? `${pdfWarning}\n\nOnce sent, you can't send again unless the admin rejects it or requests changes.`
            : `The evidence package for ${data.homeownerName || data.customer || 'this job'} will go to the admin for review. You can't send again unless the admin rejects it or requests changes.`
        }
        cancelLabel="Cancel"
        confirmLabel={pdfWarning ? 'Send anyway' : resend ? 'Resend' : 'Send'}
        busy={sending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void sendToAdmin()}
      />

      <ConfirmModal
        visible={Boolean(successMessage)}
        icon="checkmark-circle"
        title="Sent to admin"
        message={successMessage || ''}
        confirmLabel="Done"
        onConfirm={() => setSuccessMessage(null)}
      />
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
  warning: {
    backgroundColor: '#FFF4F4',
    borderColor: '#E7B8B8',
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
    padding: 10,
  },
  warningTitle: { color: '#9B1C1C', fontSize: 12, fontWeight: '800', marginBottom: 2 },
  warningText: { color: '#7A1F1F', fontSize: 12, lineHeight: 17 },
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
  lockNote: { color: '#5B6B64', fontSize: 12.5, lineHeight: 18, marginTop: 8, textAlign: 'center' },
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
