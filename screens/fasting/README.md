# Fasting prompt & fasting-times logic

This file documents exactly how two pieces work together:

| Piece | File | Role |
|-------|------|------|
| The prompt card | `components/FastingPrompt.jsx` | The daily "Do you want to fast?" card on the home screen |
| The data hook | `hooks/useFastingTimes.js` | Loads suhoor/iftar times for the device location, exposes the wake-up window |

It also summarises the helpers in `utils/fastingUtils.js` because the prompt depends on them. Nothing about these two files is left out below.

> Note on locations: `FastingPrompt.jsx` lives in `components/`, `useFastingTimes.js` lives in `hooks/`, and `fastingUtils.js` lives in `utils/` — this README is kept in `screens/fasting/` per request.

---

## 1. `hooks/useFastingTimes.js`

A hook that resolves **today's** prayer/fasting times for the user's location and exposes a few time-derived booleans. It does **not** know about the prompt UI at all — it's pure data.

### State it holds
- `location` — `{ loaded, coordinates, source, error }`. `loaded` flips to `true` once coordinates resolve (or fail to).
- `fastingData` — the raw API payload, shaped as `{ fasting: [ { time: { sahur, iftar, maghrib, ... }, ... } ] }`.
- `loading` — true until data is loaded (from cache or network).
- `error` — an error string (empty when fine).
- `nowTick` — `Date.now()`, re-set every **30 seconds** via `setInterval`. This is what keeps the live booleans (`isWakeUpWindow`, `hasSuhoorEnded`) fresh while the app stays open.
- `wakeMinutes` — `userProfile?.preferences?.wakeUpMinutesBeforeSuhoor ?? null`. Deliberately **no 45‑minute default here**; `null` means "user hasn't set a preference", and the caller decides what fallback to use. If it's `null`, the wake-up-window booleans return `false`.

### Effects (in order)

1. **Load cached times on mount.** Reads `AsyncStorage['suhoor_fasting_times']`. Parses it; if the cached `date` field isn't today (en-CA `YYYY-MM-DD`), it deletes the cache (stale yesterday data). Otherwise it sets `fastingData` from cache and `loading = false`. This is why a phone with no network still shows today's times for the rest of the day.

2. **Resolve coordinates on mount (and when `currentUser.uid` changes).** Calls `getCurrentCoordinates(uid)` (from `utils/location.js`) which resolves in priority order: a user-set manual location → device GPS → a default on the profile → none. Sets `location`.

3. **Fetch from the API once coordinates are known.** If no coordinates → `loading = false` + an error. If `fastingData` already exists (from cache) → `loading = false`, skip fetch. Otherwise fetches `fastingTimesUrl(lat, lng)` (from `config/env.js`). On `data.code === 200 && data.data?.fasting`, it stores `{ fasting: data.data.fasting }` and writes the cache `{ data, date: todayKey(), timestamp }`. Errors set `error`.

### Derived values it returns
- `todayData` — `fastingData?.fasting?.[0]` — the **first** (today) day object. Only today is ever used; tomorrow's suhoor is *not* in this object. (Callers that need tomorrow use today's suhoor time as a close approximation — see the prompt's alarm logic.)
- `checkWakeUpWindow(minutesBefore = wakeMinutes)` — a `useCallback`. Returns `true` only when `now` is inside **`[suhoorEnd − minutesBefore, suhoorEnd]`** for *today*. Returns `false` if `minutesBefore == null`, there's no suhoor time, or it can't be parsed. It builds the window from today's date + the suhoor HH:MM, so it's always today's window.
- `isWakeUpWindow` — a `useMemo` re-derived whenever `checkWakeUpWindow`, `wakeMinutes`, or `nowTick` change. = `wakeMinutes == null ? false : checkWakeUpWindow(wakeMinutes)`. So it live-ticks every 30s.
- `hasSuhoorEnded` — `useMemo`: `now > today's suhoor end`. Re-derived on `todayData`/`nowTick`.

### Things to know / edge cases
- Cache is **only wiped on mount**. If the app stays open across midnight, `todayData` stays yesterday's until a re-mount or a refetch — there's no mid-session day-rollover invalidation.
- `checkWakeUpWindow` uses **today's** suhoor end. The prompt's auto-record (below) relies on this.
- `wakeMinutes = null` (preference never set) silently disables all wake-up-window features from this hook; the prompt still has its own fallback to `45` in some paths.

---

## 2. `components/FastingPrompt.jsx`

The daily intention card. It is a **self-contained card** (returns a `<View>` with optional status banners + one card), rendered on the home screen. It is **not** a full screen.

### Dependencies it pulls in
- Data: `useFastingTimes` (`todayData`, `checkWakeUpWindow`), `useAuth` (`currentUser`, `userProfile`), `useTheme`, `useLanguage`.
- Alarm: `useAlarmState` → `scheduleDailySuhoorAlarm`, `cancelDailySuhoorAlarm` (from `context/AlarmContext.jsx`).
- Helpers: `getTargetFastingDate`, `getDefaultIntention`, `getHijriDate`, `isMondayOrThursday`, `isWhiteDay`, `isRamadan`, `isFirstNineDhulHijjah` (from `utils/fastingUtils.js`), and `hijriMonthName` (from `config/languages.js`).
- Notifications: `scheduleNotification`, `CHANNELS.fastingPrompt` (from `services/notifications.js`).
- Firestore: `dailyFastingStatus` collection, doc id pattern **`{uid}_{YYYY-MM-DD}`** (en-CA date). Fields written: `userId`, `date`, `wantsToFast`, `updatedAt` (serverTimestamp). `checkedIn` may already exist from group check-in.
- AsyncStorage cache key per day: **`suhoor_intent_{YYYY-MM-DD}`** → `'yes'` | `'no'`.

### State machine (`status`)
| `status` | What renders | Trigger |
|----------|--------------|---------|
| `idle` | The Yes/No prompt card (title, formatted target date, Hijri date, special-day badges, Yes/No buttons, default-note footnote) | Initial, or after `handleReset` |
| `confirming_yes` | "Confirm Intention" card with Back / Confirm buttons | tapping **Yes** |
| `confirming_no` | "Skip Suhoor" card with Back / Skip buttons | tapping **No** |
| `confirmed_fasting` | Small green "Intention set / alarm active" card with a **Reset** button | `handleYes` completes |
| `confirmed_not_fasting` | Small grey "Not fasting / no alarm" card with a **Reset** button | `handleNo` completes |
| `hidden` | nothing | (effectively dead — see note) |

> Note: `getTargetFastingDate()` actually covers all 24 hours (hour 0–7 → today, hour 8–23 → tomorrow), so it never returns `null` and `status === 'hidden'` from that branch is unreachable in practice. The real "hide the whole component" rule is `isPromptVisible` (see below).

Other state: `loading` (button spinner), `targetDate` (en-CA string for the day this intention is *for*), `targetDisplay` (human-formatted target date), `defaultAnswer` (does this target day default to fasting?), `isTodayTarget` (target is today vs tomorrow), `currentDayFastingStatus` (for the status banner), `bannerMode`, `nowMinutes` (current minutes-since-midnight, ticking every **60s**), toast state.

### Effects (4)

**A. `determineTarget`** (runs on mount + when `currentUser`/`userProfile`/`formatDate` change)
1. `target = getTargetFastingDate()`. If null → `status = 'hidden'` (unreachable in practice).
2. Sets `isTodayTarget = (targetDateStr === todayStr)`.
3. Checks **Firestore first** (`dailyFastingStatus/{uid}_{targetStr}`): if the doc exists, sets status to `confirmed_fasting`/`confirmed_not_fasting` from `wantsToFast` and writes the AsyncStorage cache to match. **Firestore is the source of truth.**
4. Else checks **AsyncStorage cache** `suhoor_intent_{targetStr}`: if present, uses it.
5. Else → stays `idle` and sets `defaultAnswer = getDefaultIntention(target, userProfile)`.

**B. `fetchCurrentStatus`** (runs on mount + when `currentUser` changes) — fetches **today's** (not the target's) `dailyFastingStatus` to drive the status banner. Sets `currentDayFastingStatus`: `'fasting'` if `checkedIn === true || wantsToFast === true`, `'not_fasting'` if `wantsToFast === false`, else `null`.

**C. Banner-mode computer** (runs + every **60s**, on `todayData` change) — decides which banner (if any) shows. See the timeline table below.

**D. Auto-record at the wake-up window** (runs on `currentUser`/`userProfile`/`todayData`/`checkWakeUpWindow`/`schedule…`/`cancel…`/`t` change). This is the most subtle part:
- Only fires when `checkWakeUpWindow(wakeMinutes)` is **true** — i.e. the app is open *during* today's wake-up window (the `wakeMinutes`-long period before suhoor ends). `wakeMinutes` falls back to `45` here if the preference is unset.
- Only fires if the target day has **no** Firestore doc **and no** AsyncStorage cached answer.
- Writes a `dailyFastingStatus` doc with `wantsToFast = getDefaultIntention(target, userProfile)` and caches it.
- If that default is **true** → it tries to schedule the alarm at `suhoorEnd − wakeMinutes` **but only schedules if that time is still in the future**. Since this effect runs *inside* the window (which opens at exactly `suhoorEnd − wakeMinutes`), the alarm time has already passed, so **the alarm is effectively never scheduled by the auto-record**. The reasoning: if you're already using the phone during the wake-up window, you're already awake — no alarm needed.
- If that default is **false** → it calls `cancelDailySuhoorAlarm()` (clear any leftover alarm).

Net effect: on a special day (defaults to Yes) the app silently records **today's** "fasting" intention if you happen to be in the app during the window; on an ordinary day it silently records **today's** "not fasting" and cancels the alarm. The window is **pre-8 AM**, when `getTargetFastingDate()` returns *today* (hour 0–7), so auto-record writes **today's** doc — **not** the "tomorrow" target the 8 AM prompt asks about. So auto-record does **not** pre-fill the 8 AM prompt; it only feeds today's **status banner** (which reads today's doc). If the app wasn't open during the window, nothing is auto-recorded for today.

### Handlers

**`handleYes`** (from `confirming_yes`):
1. Writes `dailyFastingStatus/{uid}_{targetDate}` with `wantsToFast: true` + `serverTimestamp`.
2. Caches `'yes'`.
3. Computes the alarm time: start from `new Date(`${targetDate}T00:00:00`)`, set hours to the suhoor HH:MM, then subtract `wakeMinutes` (default `45`). If no suhoor time → falls back to **04:30**.
4. If `scheduleDailySuhoorAlarm` exists **and the alarm time is in the future** → schedules the native exact alarm + local notification at `suhoorEnd − wakeMinutes` (the start of the wake-up window).
5. `status = confirmed_fasting`, success toast.
6. Also fires an **immediate** local notification "intention set / alarm active" on `CHANNELS.fastingPrompt`.

**`handleNo`** (from `confirming_no`):
1. Writes `dailyFastingStatus` with `wantsToFast: false` + `serverTimestamp`.
2. Caches `'no'`.
3. Calls `cancelDailySuhoorAlarm()` — any scheduled alarm is removed.
4. `status = confirmed_not_fasting`, info toast.

**`handleReset`**: recomputes `defaultAnswer` and sets `status` back to `idle` so the Yes/No card reappears. It does **not** delete the Firestore doc — but answering again uses `setDoc` (overwrite, not merge), so the new answer replaces the old one.

### Visibility rules — what renders when

Two early `return null` gates, in order:
1. `if (!isPromptVisible) return null;` where `isPromptVisible = nowMinutes >= 8*60` (08:00). **Before 08:00 the entire component — card AND banners — renders nothing.** This is the explicit fix for the old "today's prompt showing all morning" bug.
2. `if (status === 'hidden' || !targetDate) return null;` — while the target is still being resolved.

After those gates, the component always renders a `<Toast>` plus at most one banner plus the current `status` card.

### Banners (rendered only while the whole component is visible, i.e. 08:00+)

`bannerMode` is recomputed every 60s from `todayData.time`:
- now < suhoor end → `'hidden'`
- iftar ≤ now < 20:00 → `'iftar'` (amber "Time for Iftar" banner). `iftarMins` is parsed from `time.iftar`, **falling back to `time.maghrib`** if iftar is absent.
- now ≥ 20:00 → `'hidden'`
- otherwise (suhoor end ≤ now < iftar) → `'fasting_status'`

The `fasting_status` banner only actually renders if `currentDayFastingStatus` is set: green "You are fasting / May Allah accept" or grey "You are not fasting".

### Special-day badges & the default note

`isSpecial = isMondayOrThursday || isWhiteDay || isRamadan || isFirstNineDhulHijjah` (computed on the target date).
- Badges (only when `isSpecial`): Mon/Thu & not Ramadan → "Sunnah Fast"; White Day (Hijri 13–15) & not Ramadan → "White Day {day}"; First 9 of Dhul-Hijjah & not Ramadan → "Dhul-Hijjah {day}"; Ramadan → "Ramadan Day {day}". During Ramadan only the Ramadan badge shows (the others are suppressed).
- Footnote: `isSpecial && defaultAnswer` → "defaults to Yes" note. `isSpecial && !defaultAnswer` → "defaults to No" note (because that special day's Settings toggle is off).

`defaultAnswer` comes from `getDefaultIntention(date, userProfile)` — true only if the date qualifies as a special kind **and** that kind's toggle in Settings is on (each toggle defaults to **on** if absent).

### Edge cases worth knowing
- `determineTarget` runs on mount and when `currentUser`/`userProfile`/`formatDate` change — **not** when the clock crosses midnight. So if the app stays open across midnight, `targetDate`/`status` stay on yesterday's "tomorrow" until a remount or a profile change. The banners stay fresh (their computer re-runs every 60 s), but the prompt card's target can go stale in a long-lived session. In practice the component is `null` from 00:00–08:00 anyway, and most users won't hit this.
- `handleYes` and `handleNo` use `setDoc` (overwrite), so re-answering after Reset replaces the stored intention cleanly.
- The immediate "intention set" notification on `handleYes` is scheduled at `new Date()` (now), so it fires right away — it's a confirmation toast-style notification, not a timed reminder.

---

## 3. `utils/fastingUtils.js` (helpers used by the prompt)

- `getTargetFastingDate()`: hour 0–7 → **today**; hour 8–23 → **tomorrow**. (Never actually returns `null` for any real hour.)
- `getDefaultIntention(date, preferences)`: returns `true` if the date is one of the four special kinds (Ramadan, Mon/Thu, White Day, First-9 Dhul-Hijjah) **and** the matching Settings toggle is on (default on). Multiple qualifying kinds don't cancel each other; any one enabled match is enough.
- `getHijriDate(date)`: `{ day, month, year }` via `Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', …)`. Falls back to `{1,1,1445}` if the runtime lacks the Islamic calendar.
- `isMondayOrThursday`, `isWhiteDay` (Hijri 13–15), `isRamadan` (Hijri month 9), `isFirstNineDhulHijjah` (Hijri month 12, day ≤ 9).
- `WAKE_VERIFY_PATTERN = 'MM DD YYYY'`, `wakeVerifyDate`, `matchesWakeVerifyDate` — used by the separate alarm wake-up verification, not by this card.

---

## 4. Timeline — what appears and what disappears (assuming times loaded)

| Time of day | Prompt card | Banners | Background activity |
|-------------|-------------|---------|---------------------|
| 00:00–07:59 | **Hidden** (`isPromptVisible` false) | **Hidden** (whole component is null) | If app open during the wake-up window (suhoorEnd−wakeMinutes … suhoorEnd), **auto-record** may write today's intention + (if default Yes) skip the alarm / (if default No) cancel it |
| 08:00 – suhoor end* | `idle` (or already `confirmed_*` if auto-record ran) | (suhoor already ended, so this slice is tiny/empty in practice) | — |
| After suhoor end → iftar | `idle` / `confirmed_*` card visible | `fasting_status` banner (only if today's status is set) | — |
| iftar → 20:00 | `idle` / `confirmed_*` card visible | `iftar` banner ("Time for Iftar") | — |
| 20:00 → 23:59 | `idle` / `confirmed_*` card visible (prompt for **tomorrow**) | no banner (`hidden`) | — |
| (next) 00:00–07:59 | hidden again | hidden | auto-record for the new today runs if app open in that day's window |

\* Suhoor typically ends ~04:00–05:30, i.e. **before** 08:00, so in practice the "after suhoor, before iftar" fasting-status window only becomes visible from 08:00 onward.

What disappears / replaces what:
- Whole component disappears before 08:00 and (after midnight) until 08:00 again.
- The `fasting_status` banner disappears at iftar; the `iftar` banner disappears at 20:00.
- Tapping Yes/No replaces the prompt card with a small confirmation card; the small confirmation card's **Reset** brings the Yes/No card back.
- At 08:00 the prompt asks about **tomorrow**, whose doc is empty, so it shows the Yes/No (`idle`) card. Today's status (whether auto-recorded in the window or set from yesterday's prompt) shows in the **fasting_status banner**, not in the prompt card. The prompt only shows a confirmed card if the user already answered that same day's "tomorrow" prompt — then it stays confirmed until **Reset** or midnight rolls the target over.

---

## 5. Play Console warnings — can we fix them smoothly without breaking the app?

Current build facts: `compileSdk/targetSdk = 36`, `minSdk = 23`, AGP **8.2.1**, NDK **26.1**, RN **0.74**, Expo **SDK 51**. Theme = `Theme.AppCompat.DayNight.NoActionBar` with `android:statusBarColor` set (and the splash theme also sets `navigationBarColor`). `MainActivity.kt` does **not** call `enableEdgeToEdge()`.

### Warning 1 — "Edge-to-edge may not display for all users"
**Smooth? Yes (low risk).** Because `targetSdk = 36`, Android draws edge-to-edge by default; we just need to opt in explicitly and handle insets. The app already depends on `react-native-safe-area-context` (4.10.5), so the pieces exist.

How I'd do it:
- In `MainActivity.kt`, call `enableEdgeToEdge()` inside `onCreate` (before `setupLockScreenFlags()`). For a `ReactActivity`, the simplest is `WindowCompat.setDecorFitsSystemWindows(window, false)` in `onCreate` (Kotlin), or use the official `androidx.activity.enableEdgeToEdge()` if the `androidx.activity` version allows it.
- Audit screens that currently render content flush to the top/bottom: any screen using a raw top padding instead of `SafeAreaView`/`useSafeAreaInsets` will have content slip under the status/nav bar. Fix those by wrapping in `SafeAreaView` (from `react-native-safe-area-context`) or applying `insets.top`/`insets.bottom`. The auth/onboarding screens already use `SafeAreaView`; the main risk is the tab screens and modals.
- Risk: low. The only breakage would be screens that look fine *because* of the non-edge-to-edge padding today; those need insets. Purely additive otherwise.

### Warning 2 — "Your app uses deprecated APIs or parameters for edge-to-edge / window display"
**Smooth? Yes (low risk).** The deprecated parameters are in `res/values/styles.xml`: `android:statusBarColor` (in `AppTheme`) and `android:statusBarColor` + `android:navigationBarColor` (in `Theme.App.SplashScreen`). `statusBarColor`/`navigationBarColor` are deprecated for edge-to-edge on API 35+.

How I'd do it:
- Remove `android:statusBarColor` and `android:navigationBarColor` from both themes (once edge-to-edge is on, the bars become transparent and content draws behind them).
- Let the JS side control bar appearance via `react-native-safe-area-context` / the `StatusBar` component (already in use), which uses the modern `WindowInsetsController` path.
- `MainActivity.kt`'s `window.addFlags(FLAG_SHOW_WHEN_LOCKED | FLAG_TURN_SCREEN_ON | FLAG_DISMISS_KEYGUARD | FLAG_KEEP_SCREEN_ON)` is deprecated too, but it's already guarded with `@Suppress("DEPRECATION")` and only runs on API < 26 (pre-O_MR1); on API ≥ 26 it uses `setShowWhenLocked(true)`/`setTurnScreenOn(true)`. These are lock-screen flags, not the edge-to-edge APIs Play is flagging, so they're fine to leave.
- Risk: low. The visual change is that the status/nav bars become transparent (content behind them) — which is exactly what edge-to-edge is supposed to look like. Need a quick visual pass in light + dark + RTL.

### Warning 3 — "Recompile your app with 16 KB native library alignment"
**Smooth? No — this is the one that isn't a small patch.** This requires the native `.so` files' ELF `LOAD` segments to be aligned to 16 KB (a **compile-time** linker setting, `-Wl,-z,max-page-size=16384`), not just a zipalign step. The prebuilt native libraries that ship with RN 0.74 / Expo SDK 51 (react-android, hermes-android, reanimated, soloader, expo modules) were built with 4 KB alignment, and you can't recompile someone else's prebuilt AAR by flipping a flag.

What a real fix needs:
- NDK **r27+** with 16 KB-aligned prebuilt libraries → which means **upgrading to RN 0.76+ / Expo SDK 52+** (those versions ship 16 KB-aligned native libs and the right NDK). That's a real SDK upgrade with its own migration steps (deprecated APIs, config changes), so it can break things and needs its own testing pass.
- Bump AGP to **8.5.1+** (Gradle 8.7+) so the packaging step also 16 KB-aligns the `.so` entries inside the APK/AAB. The current AGP is 8.2.1, which does **not** do this.

Partial mitigation (doesn't fully clear the warning): bump AGP to 8.5.1+ and set 16 KB zipalign so the APK *packages* the libs at 16 KB file alignment. That helps installation on some 16 KB-page devices but does **not** fix the ELF segment alignment of the prebuilt `.so`, so the warning likely persists and the crash risk on true 16 KB-page-size devices (e.g. newer Pixel kernels) remains.

Recommendation: do **1 and 2 now** (smooth, same PR), and treat **3 as a dedicated Expo SDK 51 → 52/53 upgrade** (RN 0.76+) in its own branch with a full regression test — that's the only way to ship genuinely 16 KB-aligned native libraries.

