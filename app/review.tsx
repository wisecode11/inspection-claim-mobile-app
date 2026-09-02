import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { InfoRow, OutlineButton, PrimaryButton, Screen, ui } from '@/components/inspection-ui';
import { Brand } from '@/constants/theme';
import { useInspection } from '@/context/inspection-context';
import { CAPTURE_STEPS } from '@/lib/capture-steps';
import { findInspectionGaps, photosForStep } from '@/lib/review-gaps';
import { captureHref } from '@/lib/routes';

export default function ReviewScreen() {
  const router = useRouter();
  const { data, update } = useInspection();
  const gaps = findInspectionGaps(data);

  const openStep = (stepId: (typeof CAPTURE_STEPS)[number]['id']) => {
    update({ currentStepId: stepId });
    router.push(captureHref(stepId));
  };

  return (
    <Screen edges={['bottom']}>
      <ScrollView contentContainerStyle={ui.content}>
        <Text style={ui.title}>Review & quality check</Text>
        <Text style={ui.subtitle}>
          Inspection progress {data.completedSteps.length}/{CAPTURE_STEPS.length}. Warnings do not
          block finalizing.
        </Text>

        <View style={[ui.card, { marginTop: 20 }]}>
          <InfoRow label="Homeowner" value={data.homeownerName || data.customer} />
          <InfoRow label="Property" value={data.address} />
          <InfoRow label="Roof age" value={data.estimatedRoofAge || '—'} />
          <InfoRow label="Total photos" value={String(data.photos.length)} />
          <InfoRow
            label="Weather"
            value={data.weatherSummary?.badgeTitle || data.weatherStatus || 'No data'}
            last
          />
        </View>

        <Text style={styles.section}>Category photo counts</Text>
        <View style={ui.card}>
          {CAPTURE_STEPS.map((step, index) => {
            const count = photosForStep(data.photos, step.id).length;
            const done = data.completedSteps.includes(step.id) || count > 0;
            return (
              <Pressable
                key={step.id}
                style={[styles.row, index === CAPTURE_STEPS.length - 1 && styles.rowLast]}
                onPress={() => openStep(step.id)}
              >
                <Text style={styles.rowTitle}>
                  {done ? '✓ ' : ''}
                  {step.number}. {step.title}
                </Text>
                <Text style={styles.rowMeta}>{count} photos</Text>
              </Pressable>
            );
          })}
        </View>

        {gaps.length > 0 ? (
          <>
            <Text style={styles.section}>Documentation gaps</Text>
            <View style={[ui.card, styles.warnCard]}>
              {gaps.map((gap) => (
                <Pressable
                  key={`${gap.stepId}-${gap.message}`}
                  style={styles.gapRow}
                  onPress={() => openStep(gap.stepId)}
                >
                  <Text style={styles.gapTitle}>{gap.title}</Text>
                  <Text style={styles.gapText}>{gap.message}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.ok}>No major documentation gaps detected.</Text>
        )}

        <View style={{ marginTop: 24 }}>
          <PrimaryButton title="Generate Final PDF" onPress={() => router.push('/report')} />
          <View style={{ marginTop: 10 }}>
            <OutlineButton title="Edit PDF draft" onPress={() => router.push('/report-draft')} />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    color: '#133A42',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
    marginTop: 22,
  },
  row: {
    borderBottomColor: '#EDF1F2',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  rowLast: { borderBottomWidth: 0 },
  rowTitle: { color: '#133A42', flex: 1, fontSize: 14, fontWeight: '700' },
  rowMeta: { color: '#70818A', fontSize: 13, fontWeight: '700' },
  warnCard: { backgroundColor: Brand.accentLight },
  gapRow: { paddingVertical: 10 },
  gapTitle: { color: Brand.accent, fontSize: 14, fontWeight: '800' },
  gapText: { color: '#7A5A45', fontSize: 13, marginTop: 2 },
  ok: { color: '#1F7A45', fontSize: 14, fontWeight: '700', marginTop: 18 },
});
