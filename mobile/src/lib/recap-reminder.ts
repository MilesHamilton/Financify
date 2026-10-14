import * as Notifications from 'expo-notifications';

const ID = 'monthly-recap';

/** Local notification at 9 am on the 1st of every month; no server or push entitlement needed. */
export async function scheduleMonthlyRecap(): Promise<boolean> {
  const { granted } = await Notifications.requestPermissionsAsync();
  if (!granted) return false;
  await Notifications.cancelScheduledNotificationAsync(ID).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: ID,
    content: {
      title: 'Your monthly recap is ready',
      body: 'See where last month went, and what kind of spender you were.',
      data: { url: '/recap' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.CALENDAR, day: 1, hour: 9, minute: 0, repeats: true },
  });
  return true;
}

export async function isRecapScheduled(): Promise<boolean> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all.some((n) => n.identifier === ID);
}
