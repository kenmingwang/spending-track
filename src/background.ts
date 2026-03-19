import { getStoredLanguage, t } from './utils/i18n';

const WEEKLY_REMINDER_ALARM = 'weekly-bank-login-reminder';

const ensureWeeklyReminder = () => {
  chrome.alarms.get(WEEKLY_REMINDER_ALARM, (existing) => {
    if (existing) return;
    chrome.alarms.create(WEEKLY_REMINDER_ALARM, {
      periodInMinutes: 60 * 24 * 7,
      delayInMinutes: 1,
    });
  });
};

const notifyWeeklyReminder = async () => {
  const language = await getStoredLanguage();
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'images/icon48.png',
    title: t(language, 'notif_title'),
    message: t(language, 'notif_message'),
    priority: 1,
  });
};

chrome.runtime.onInstalled.addListener(() => {
  ensureWeeklyReminder();
  // First-run nudge so users know reminder is now popup-based.
  void notifyWeeklyReminder();
});

chrome.runtime.onStartup.addListener(() => {
  ensureWeeklyReminder();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== WEEKLY_REMINDER_ALARM) return;
  void notifyWeeklyReminder();
});

chrome.notifications.onClicked.addListener(() => {
  chrome.tabs.create({ url: 'dashboard/dashboard.html' });
});
