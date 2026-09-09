import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SafeTopGuard } from '@/components/safe-top-guard';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import {
  fetchNotifications,
  InboxNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/api';
import { syncAppBadge } from '@/lib/notification-inbox';

const HeroPrimary = Brand.accent;
const HeroTextMuted = '#8FAEB8';
const BodyBg = Brand.sheetBg;
const TextPrimary = '#1A1A1A';
const TextSecondary = '#6B7280';
const CardBorder = '#EBE6DF';
const StatusGold = '#C49A2C';

function formatWhen(iso: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [items, setItems] = useState<InboxNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (mode: 'full' | 'refresh' = 'full') => {
      if (!token) return;
      if (mode === 'full') setLoading(true);
      else setRefreshing(true);
      setError('');
      try {
        const result = await fetchNotifications(token, { limit: 50 });
        setItems(result.items);
        await syncAppBadge(result.unreadCount);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load notifications');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useFocusEffect(
    useCallback(() => {
      void load('full');
    }, [load]),
  );

  const onOpenItem = async (item: InboxNotification) => {
    if (!token) return;
    try {
      if (!item.readAt) {
        await markNotificationRead(token, item.id);
        setItems((prev) =>
          prev.map((row) =>
            row.id === item.id ? { ...row, readAt: new Date().toISOString() } : row,
          ),
        );
        const nextUnread = items.filter((row) => row.id !== item.id && !row.readAt).length;
        await syncAppBadge(nextUnread);
      }
    } catch {
      // Still navigate even if mark-read fails.
    }

    if (item.data?.jobId || item.type === 'job_assigned') {
      router.push('/(tabs)/jobs');
    }
  };

  const onMarkAll = async () => {
    if (!token || markingAll) return;
    setMarkingAll(true);
    try {
      await markAllNotificationsRead(token);
      setItems((prev) =>
        prev.map((row) => ({ ...row, readAt: row.readAt || new Date().toISOString() })),
      );
      await syncAppBadge(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mark all read');
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = items.filter((item) => !item.readAt).length;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <SafeTopGuard color={HeroPrimary} />

      <View style={styles.heroSection}>
        <View style={styles.heroOrbLarge} pointerEvents="none" />
        <View style={styles.heroOrbSmall} pointerEvents="none" />

        <View style={styles.topBar}>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Ionicons color="#FFFFFF" name="chevron-back" size={24} />
          </Pressable>
          <Text style={styles.topBarTitle}>Notifications</Text>
          <View style={styles.backBtn} />
        </View>

        <Text style={styles.heroEyebrow}>INBOX</Text>
        <Text style={styles.heroTitle}>
          {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
        </Text>
        <Text style={styles.heroBody}>
          Job assignments and field alerts for your inspections.
        </Text>
      </View>

      <View style={styles.bodySheet}>
        <View style={styles.toolbar}>
          <Text style={styles.toolbarHint}>
            {unreadCount > 0 ? 'New updates below' : 'Nothing waiting right now'}
          </Text>
          <Pressable
            disabled={markingAll || unreadCount === 0}
            hitSlop={8}
            onPress={() => void onMarkAll()}
            style={({ pressed }) => [
              styles.markAllBtn,
              (markingAll || unreadCount === 0) && styles.markAllDisabled,
              pressed && unreadCount > 0 && !markingAll && styles.pressed,
            ]}
          >
            {markingAll ? (
              <ActivityIndicator color={HeroPrimary} size="small" />
            ) : (
              <Text style={styles.markAllText}>Mark all read</Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              colors={[HeroPrimary]}
              onRefresh={() => void load('refresh')}
              refreshing={refreshing}
              tintColor={HeroPrimary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {error ? (
            <Pressable onPress={() => void load('full')} style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
              <Text style={styles.errorRetry}>Tap to retry</Text>
            </Pressable>
          ) : null}

          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color={HeroPrimary} />
            </View>
          ) : items.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons color={HeroPrimary} name="notifications-outline" size={26} />
              </View>
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptyBody}>
                When a job is assigned to you, it will show up here.
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {items.map((item) => {
                const unread = !item.readAt;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => void onOpenItem(item)}
                    style={({ pressed }) => [
                      styles.card,
                      unread && styles.cardUnread,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.cardHeader}>
                      <View
                        style={[
                          styles.iconWrap,
                          unread ? styles.iconWrapUnread : styles.iconWrapRead,
                        ]}
                      >
                        <Ionicons
                          color={unread ? HeroPrimary : Brand.soft}
                          name={unread ? 'notifications' : 'notifications-outline'}
                          size={18}
                        />
                      </View>
                      <View style={styles.cardCopy}>
                        {unread ? (
                          <View style={styles.statusLine}>
                            <View style={styles.statusDot} />
                            <Text style={styles.statusLineText}>NEW · JOB ALERT</Text>
                          </View>
                        ) : null}
                        <View style={styles.cardTop}>
                          <Text style={styles.cardTitle} numberOfLines={1}>
                            {item.title}
                          </Text>
                          <Text style={styles.cardWhen}>{formatWhen(item.createdAt)}</Text>
                        </View>
                        {item.body ? (
                          <Text style={styles.cardBody} numberOfLines={2}>
                            {item.body}
                          </Text>
                        ) : null}
                        {item.data?.jobNumber ? (
                          <Text style={styles.cardMeta}>{item.data.jobNumber}</Text>
                        ) : null}
                      </View>
                      <Ionicons color={Brand.soft} name="chevron-forward" size={18} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: HeroPrimary,
    flex: 1,
  },
  heroSection: {
    backgroundColor: HeroPrimary,
    overflow: 'hidden',
    paddingBottom: 28,
    paddingHorizontal: 20,
    paddingTop: 8,
    position: 'relative',
  },
  heroOrbLarge: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 999,
    height: 180,
    position: 'absolute',
    right: -50,
    top: -40,
    width: 180,
  },
  heroOrbSmall: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 999,
    bottom: 10,
    height: 90,
    left: -30,
    position: 'absolute',
    width: 90,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  backBtn: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  topBarTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  heroEyebrow: {
    color: HeroTextMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginTop: 8,
  },
  heroBody: {
    color: HeroTextMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    maxWidth: '92%',
  },
  bodySheet: {
    backgroundColor: BodyBg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    flex: 1,
    marginTop: -10,
    overflow: 'hidden',
  },
  toolbar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 6,
  },
  toolbarHint: {
    color: Brand.muted,
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    marginRight: 12,
  },
  markAllBtn: {
    justifyContent: 'center',
    minHeight: 32,
    paddingHorizontal: 4,
  },
  markAllDisabled: {
    opacity: 0.4,
  },
  markAllText: {
    color: HeroPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  list: {
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: CardBorder,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 2,
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  cardUnread: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(19,58,66,0.16)',
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 14,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  iconWrapUnread: {
    backgroundColor: Brand.accentLight,
  },
  iconWrapRead: {
    backgroundColor: '#F3F1EC',
  },
  cardCopy: {
    flex: 1,
  },
  statusLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  statusDot: {
    backgroundColor: StatusGold,
    borderRadius: 4,
    height: 6,
    width: 6,
  },
  statusLineText: {
    color: StatusGold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  cardTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  cardTitle: {
    color: TextPrimary,
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  cardWhen: {
    color: Brand.soft,
    fontSize: 11,
    fontWeight: '500',
  },
  cardBody: {
    color: TextSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  cardMeta: {
    color: HeroPrimary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  empty: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: CardBorder,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 36,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: Brand.accentLight,
    borderRadius: 18,
    height: 56,
    justifyContent: 'center',
    marginBottom: 14,
    width: 56,
  },
  emptyTitle: {
    color: HeroPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  emptyBody: {
    color: Brand.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: '#FDECEC',
    borderRadius: 14,
    marginBottom: 12,
    padding: 14,
  },
  errorText: {
    color: Brand.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  errorRetry: {
    color: Brand.danger,
    fontSize: 12,
    marginTop: 4,
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: 0.9,
  },
});
