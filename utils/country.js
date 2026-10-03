/**
 * Utility to detect the user's location on sign-up using fast, lightweight
 * geolocation APIs with timezone fallback that returns country instead of city.
 * Returns a formatted "City/Region, Country" string (e.g., "Lagos, Nigeria").
 */
export async function detectUserCountry() {
  // --- Attempt 1: ipwho.is (returns city, region, country) ---
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch("https://ipwho.is/", { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (data?.success !== false && data?.country) {
        const cityOrRegion = data.city || data.region || "Unknown";
        const country = data.country;
        return `${cityOrRegion}, ${country}`;
      }
    }
  } catch (e) {
    // fall through
  }

  // --- Attempt 2: api.country.is (country only) ---
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch("https://api.country.is", {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (data?.country) {
        let countryName = data.country;
        if (typeof Intl !== "undefined" && Intl.DisplayNames) {
          const regionNames = new Intl.DisplayNames(["en"], {
            type: "region",
          });
          countryName = regionNames.of(data.country) || data.country;
        }
        // No city available from this API
        return countryName;
      }
    }
  } catch (e) {
    // fall through
  }

  // --- Attempt 3: Timezone fallback (returns country code, not city) ---
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) {
      const parts = tz.split("/");
      // Example: "Africa/Lagos" → "Lagos" was wrong, now returns "Nigeria"
      const regionCode = parts[0]; // Get "Africa" from "Africa/Lagos"
      if (typeof Intl !== "undefined" && Intl.DisplayNames) {
        const regionNames = new Intl.DisplayNames(["en"], {
          type: "region",
        });
        const countryName = regionNames.of(regionCode);
        if (countryName && countryName !== regionCode) {
          return countryName;
        }
      }
    }
  } catch (e) {
    // fall through
  }

  return "Unknown";
}