import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { PdfPreview } from '@/components/pdf-preview';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useOpenJob } from '@/hooks/use-open-job';
import { fetchJob, jobAddressText, jobCustomerName, type InspectionJob } from '@/lib/api';
import {
  downloadSubmittedPdf,
  formatReviewDate,
  latestReport,
  reviewReason,
  reviewStateForJob,
  type ReviewState,
} from '@/lib/job-review';
import { shareInspectionPdf, viewInspectionPdf } from '@/utils/create-inspection-pdf';

const TONES: Record<ReviewState, { bg: string; fg: string; icon: IconName; title: string }> = {
  pending: {
    bg: '#FFF8E6',
    fg: '#9A6700',
    icon: 'time-outline',
    title: 'Waiting for admin approval',
  },
  changes_requested: {
    bg: '#FFF4E8',
    fg: '#C45A1A',
    icon: 'alert-circle-outline',
    title: 'Admin requested changes',
  },
  rejected: {
    bg: '#FEF2F2',
    fg: '#B42318',
    icon: 'close-circle',
    title: 'Report rejected by admin',
  },
  approved: {
    bg: '#EDF7F1',
    fg: '#1D6B3F',
    icon: 'checkmark-circle',
    title: 'Report approved',
  },
};

function TimelineStep({
  label,
  detail,
  state,
  last = false,
}: {
  label: string;
  detail?: string;
  state: 'done' | 'current' | 'upcoming';
  last?: boolean;
}) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepRail}>
        <View
          style={[
            styles.stepDot,
            state === 'done' && styles.stepDotDone,
            state === 'current' && styles.stepDotCurrent,
          ]}
        >
          {state === 'done' ? <Icon color="#FFFFFF" name="checkmark" size={12} /> : null}
        </View>
        {!last ? <View style={[styles.stepLine, state === 'done' && styles.stepLineDone]} /> : null}
      </View>
      <View style={styles.stepCopy}>
        <Text style={[styles.stepLabel, state === 'upcoming' && styles.stepLabelUpcoming]}>{label}</Text>
        {detail ? <Text style={styles.stepDetail}>{detail}</Text> : null}
      </View>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  variant = 'outline',
  busy = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'danger';
  busy?: boolean;
}) {
  const color = variant === 'outline' ? Brand.accent : '#FFFFFF';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'danger' && styles.buttonDanger,
        variant === 'outline' && styles.buttonOutline,
        (pressed || busy) && styles.pressed,
      ]}
    >
      {busy ? <ActivityIndicator color={color} /> : <Icon color={color} name={icon} size={18} />}
      <Text style={[styles.buttonText, { color }]}>{label}</Text>
    </Pressable>
  );
}

export default function JobStatusScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { token } = useAuth();
  const { openJob, openingJobId } = useOpenJob();

  const [job, setJob] = useState<InspectionJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (!token || !jobId) return;
      if (mode === 'refresh') setRefreshing(true);
      try {
        setJob(await fetchJob(token, jobId));
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load this job.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [jobId, token],
  );

  // Refetch whenever the screen is shown, so a decision made while away is picked up.
  useFocusEffect(
    useCallback(() => {
      void load('initial');
    }, [load]),
  );

  const state = job ? reviewStateForJob(job) : null;
  const report = job ? latestReport(job) : null;

  // Approved reports show the submitted PDF inline, so fetch it as soon as we know.
  useEffect(() => {
    if (state !== 'approved' || !report?.pdfUrl) return;
    let active = true;
    setPdfError('');
    downloadSubmittedPdf(report)
      .then((uri) => {
        if (active) setPdfUri(uri);
      })
      .catch((err) => {
        if (active) setPdfError(err instanceof Error ? err.message : 'Could not load the PDF.');
      });
    return () => {
      active = false;
    };
  }, [state, report]);

  const withPdf = async (action: (uri: string) => Promise<void>) => {
    if (!report) return;
    setPdfBusy(true);
    try {
      const uri = pdfUri || (await downloadSubmittedPdf(report));
      setPdfUri(uri);
      await action(uri);
    } catch (err) {
      Alert.alert('PDF unavailable', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setPdfBusy(false);
    }
  };

  if (loading && !job) {
    return (
      <SafeAreaView edges={['bottom']} style={[styles.screen, styles.center]}>
        <ActivityIndicator color={Brand.accent} size="large" />
      </SafeAreaView>
    );
  }

  if (!job || !state) {
    return (
      <SafeAreaView edges={['bottom']} style={[styles.screen, styles.center]}>
        <Text style={styles.errorTitle}>Status unavailable</Text>
        <Text style={styles.errorText}>
          {error || 'This job has not been sent to the admin yet.'}
        </Text>
        <View style={styles.errorAction}>
          <ActionButton icon="refresh-outline" label="Try again" onPress={() => void load('refresh')} />
        </View>
      </SafeAreaView>
    );
  }

  const tone = TONES[state];
  const reason = reviewReason(job);
  const submittedAt = formatReviewDate(report?.submittedAt || job.submittedAt);
  const reviewedAt = formatReviewDate(report?.reviewedAt || job.reviewedAt || job.completedAt);
  const underReview = report?.status === 'under_review';
  const sentBack = state === 'rejected' || state === 'changes_requested';

  const resend = () => void openJob(job, { skipStatusScreen: true, detail: job });

  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            colors={[Brand.accent]}
            onRefresh={() => void load('refresh')}
            refreshing={refreshing}
            tintColor={Brand.accent}
          />
        }
      >
        <View style={[styles.hero, { backgroundColor: tone.bg }]}>
          <View style={[styles.heroIcon, { backgroundColor: '#FFFFFF' }]}>
            <Icon color={tone.fg} name={tone.icon} size={28} />
          </View>
          <Text style={[styles.heroTitle, { color: tone.fg }]}>{tone.title}</Text>
          <Text style={styles.heroCopy}>
            {state === 'pending'
              ? underReview
                ? 'The admin is reviewing your evidence package. Pull down to check for updates.'
                : 'Your evidence package was sent. The admin has not reviewed it yet.'
              : state === 'approved'
                ? 'The admin approved your evidence package. This job is complete.'
                : 'The admin sent this report back. Fix the issues below and send it again.'}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Job</Text>
          <Text style={styles.jobTitle}>{jobCustomerName(job) || 'Inspection'}</Text>
          <Text style={styles.jobMeta}>{jobAddressText(job) || 'No address on file'}</Text>
          {job.jobNumber ? <Text style={styles.jobMeta}>#{job.jobNumber}</Text> : null}
        </View>

        {sentBack ? (
          <View style={[styles.card, styles.reasonCard]}>
            <Text style={[styles.cardLabel, { color: tone.fg }]}>
              {state === 'rejected' ? 'Reason for rejection' : 'Changes requested'}
            </Text>
            <Text style={styles.reasonText}>{reason || 'The admin did not add a reason.'}</Text>
            {reviewedAt ? <Text style={styles.reasonMeta}>Reviewed {reviewedAt}</Text> : null}
            <View style={styles.reasonAction}>
              <ActionButton
                busy={openingJobId === String(job.id)}
                icon="refresh-outline"
                label="Fix & resend"
                onPress={resend}
                variant="danger"
              />
            </View>
          </View>
        ) : null}

        {state === 'pending' ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Progress</Text>
            <View style={styles.timeline}>
              <TimelineStep detail={submittedAt} label="Sent to admin" state="done" />
              <TimelineStep
                detail={underReview ? 'In progress' : 'Waiting for the admin'}
                label="Admin review"
                state="current"
              />
              <TimelineStep label="Approved" last state="upcoming" />
            </View>
          </View>
        ) : null}

        {state === 'approved' ? (
          <>
            <View style={styles.card}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Submitted</Text>
                <Text style={styles.detailValue}>{submittedAt || '—'}</Text>
              </View>
              <View style={[styles.detailRow, !report?.reviewNotes && styles.detailRowLast]}>
                <Text style={styles.detailLabel}>Approved</Text>
                <Text style={styles.detailValue}>{reviewedAt || '—'}</Text>
              </View>
              {report?.reviewNotes ? (
                <View style={styles.notes}>
                  <Text style={styles.detailLabel}>Admin notes</Text>
                  <Text style={styles.notesText}>{report.reviewNotes}</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.sectionTitle}>Submitted report</Text>
            {!report?.pdfUrl ? (
              <View style={[styles.card, styles.center]}>
                <Text style={styles.errorText}>No PDF was attached to this report.</Text>
              </View>
            ) : pdfUri ? (
              <PdfPreview style={styles.pdf} uri={pdfUri} />
            ) : (
              <View style={[styles.pdf, styles.pdfPlaceholder]}>
                {pdfError ? (
                  <Text style={styles.errorText}>{pdfError}</Text>
                ) : (
                  <ActivityIndicator color={Brand.accent} />
                )}
              </View>
            )}
          </>
        ) : null}

        {report?.pdfUrl ? (
          <View style={styles.actions}>
            <ActionButton
              busy={pdfBusy}
              icon="expand-outline"
              label={state === 'approved' ? 'Open' : 'View submitted PDF'}
              onPress={() => void withPdf(viewInspectionPdf)}
              variant={state === 'approved' ? 'primary' : 'outline'}
            />
            {state === 'approved' ? (
              <ActionButton
                busy={pdfBusy}
                icon="share-outline"
                label="Share"
                onPress={() => void withPdf(shareInspectionPdf)}
              />
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: Brand.sheetBg,
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    gap: 14,
    padding: 20,
    paddingBottom: 40,
  },
  hero: {
    alignItems: 'center',
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  heroIcon: {
    alignItems: 'center',
    borderRadius: 20,
    height: 56,
    justifyContent: 'center',
    marginBottom: 12,
    width: 56,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  heroCopy: {
    color: Brand.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    textAlign: 'center',
  },
  card: {
    backgroundColor: Brand.surface,
    borderRadius: 20,
    elevation: 1,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  cardLabel: {
    color: Brand.soft,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  jobTitle: {
    color: Brand.ink,
    fontSize: 17,
    fontWeight: '800',
  },
  jobMeta: {
    color: Brand.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  reasonCard: {
    borderColor: '#F5C7C7',
    borderWidth: 1,
  },
  reasonText: {
    color: Brand.ink,
    fontSize: 15,
    lineHeight: 22,
  },
  reasonMeta: {
    color: Brand.soft,
    fontSize: 12,
    marginTop: 8,
  },
  reasonAction: {
    flexDirection: 'row',
    marginTop: 16,
  },
  timeline: {
    marginTop: 6,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 12,
  },
  stepRail: {
    alignItems: 'center',
    width: 22,
  },
  stepDot: {
    alignItems: 'center',
    backgroundColor: Brand.surface,
    borderColor: Brand.border,
    borderRadius: 11,
    borderWidth: 2,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  stepDotDone: {
    backgroundColor: '#1D6B3F',
    borderColor: '#1D6B3F',
  },
  stepDotCurrent: {
    borderColor: '#9A6700',
    borderWidth: 6,
  },
  stepLine: {
    backgroundColor: Brand.border,
    flex: 1,
    minHeight: 22,
    width: 2,
  },
  stepLineDone: {
    backgroundColor: '#1D6B3F',
  },
  stepCopy: {
    flex: 1,
    paddingBottom: 18,
  },
  stepLabel: {
    color: Brand.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  stepLabelUpcoming: {
    color: Brand.soft,
  },
  stepDetail: {
    color: Brand.muted,
    fontSize: 12,
    marginTop: 2,
  },
  detailRow: {
    borderBottomColor: '#EDF1F2',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    color: Brand.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  detailValue: {
    color: Brand.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  notes: {
    paddingTop: 10,
  },
  notesText: {
    color: Brand.ink,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  sectionTitle: {
    color: Brand.ink,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  pdf: {
    height: 520,
  },
  pdfPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#E9EEF0',
    borderRadius: 16,
    justifyContent: 'center',
    padding: 24,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    alignItems: 'center',
    borderRadius: Brand.buttonRadiusLg,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 14,
  },
  buttonPrimary: {
    backgroundColor: Brand.accent,
  },
  buttonDanger: {
    backgroundColor: '#B42318',
  },
  buttonOutline: {
    backgroundColor: Brand.surface,
    borderColor: Brand.accent,
    borderWidth: 1.5,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
  errorTitle: {
    color: Brand.ink,
    fontSize: 20,
    fontWeight: '800',
  },
  errorText: {
    color: Brand.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    textAlign: 'center',
  },
  errorAction: {
    flexDirection: 'row',
    marginTop: 18,
    width: 220,
  },
});
