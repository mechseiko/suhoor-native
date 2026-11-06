/**
 * Night-time warning windows for phone/silent mode and offline states.
 *
 * The fasting API only returns `time.sahur` and `time.iftar` (no fajr, no
 * maghrib), and suhoor end *is* the Fajr boundary the alarm cares about, so it
 * is the correct anchor for "the night is over".
 *
 * Window: 20:00 -> suhoor end (crossing midnight). Before this shared helper,
 * the end was hard-coded to 04:30, which was wrong whenever suhoor moved.
 */

/** "HH:MM" -> minutes since midnight, or null when unparseable. */
export const parseHHMM = (value) => {
  if (!value || typeof value !== 'string') return null;
  const [h, m] = value.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};

/** True between 20:00 and the end of suhoor, based on the API's sahur time. */
export const isNightWarningWindow = (todayData, now = new Date()) => {
  const suhoorMins = parseHHMM(todayData?.time?.sahur);
  if (suhoorMins === null) return false;

  const nowMins = now.getHours() * 60 + now.getMinutes();
  return nowMins >= 20 * 60 || nowMins < suhoorMins;
};

/** Cache key so a warning is delivered at most once per night. */
export const nightKey = (now = new Date()) => now.toLocaleDateString('en-CA');
