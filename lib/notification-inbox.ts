import * as Notifications from 'expo-notifications';

/** Keep iOS/Android launcher badge in sync with inbox unread count. */
export async function syncAppBadge(unreadCount: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(Math.max(0, unreadCount));
  } catch {
    // Badge APIs are unavailable on some platforms/builds.
  }
}
