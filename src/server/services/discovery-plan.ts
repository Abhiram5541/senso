import type { DiscoveryQuery } from "./harvest-service";

/* ---------------------------------------------------------------------------
 * Where new creators are looked for.
 *
 * Discovery is `search.list` at 100 quota units a call, so the plan is a
 * fixed, rotating list rather than anything adaptive: every query gets its
 * turn, a day's budget decides how many turns a day, and the same list is what
 * an operator sweeps by hand — the scheduler and the script cannot disagree
 * about what "the places" are.
 *
 * The rotation is Telangana and Andhra Pradesh only (D50): every place query is
 * a TG/AP city or a Telugu statewide phrase, so the daily pass spends its quota
 * on the two states the product is for rather than on national categories or
 * Karnataka. The national `CATEGORY_PLAN` still exists for a manual harvest; it
 * is no longer in the daily rotation.
 * ------------------------------------------------------------------------ */

// Active in the last ~18 months. A channel silent longer than that is not a
// creator anyone is going to brief.
const publishedAfter = "2025-03-01T00:00:00Z";
const IN = { regionCode: "IN", order: "relevance", publishedAfter } as const;
const en = (q: string, extra: Partial<DiscoveryQuery> = {}): DiscoveryQuery => ({ q, relevanceLanguage: "en", ...IN, ...extra });
const te = (q: string, extra: Partial<DiscoveryQuery> = {}): DiscoveryQuery => ({ q, relevanceLanguage: "te", ...IN, ...extra });

/**
 * Searches phrased as a local would write them, ranked by relevance so the
 * results are *about* the place rather than merely popular, in Telugu where
 * that is what a local creator writes in. Cities span both states —
 * Hyderabad/Warangal/Karimnagar (Telangana), the Godavari/coastal/Rayalaseema
 * cities (Andhra Pradesh) — plus a statewide Telugu group that catches a
 * creator who tags a language, not a city.
 */
export const PLACE_QUERIES: Record<string, DiscoveryQuery[]> = {
  // Statewide: Telugu is the strongest TG/AP signal, and catches creators who
  // never name a city.
  Telugu: [
    te("telugu vlog"),
    te("telugu comedy", { videoCategoryId: "23" }),
    te("telugu food vlog"),
    te("Andhra Pradesh vlog"),
    te("Telangana vlog"),
    te("telugu tech review", { videoCategoryId: "28" }),
    te("telugu travel vlog", { videoCategoryId: "19" }),
    te("telugu daily vlog family"),
    te("telugu fitness gym", { videoCategoryId: "17" }),
    te("telugu beauty makeup", { videoCategoryId: "26" }),
  ],
  Hyderabad: [
    en("Hyderabad vlog"),
    en("Hyderabad food vlog"),
    en("Hyderabad street food"),
    te("హైదరాబాద్ vlog"),
    en("Hyderabad biryani review"),
    en("Hyderabad shopping haul"),
    en("Hyderabad tech review", { videoCategoryId: "28" }),
    en("Hyderabad fitness gym", { videoCategoryId: "17" }),
    en("Hyderabad fashion"),
    en("Hyderabad makeup", { videoCategoryId: "26" }),
    en("Hyderabad travel places", { videoCategoryId: "19" }),
    en("Hyderabad comedy", { videoCategoryId: "23" }),
    te("hyderabad telugu vlog"),
    te("హైదరాబాద్ food"),
    en("Hyderabad cafe restaurant review"),
    en("Hyderabad real estate"),
    en("Hyderabad startup"),
    en("Hyderabadi"),
    en("Hyderabad cars bikes", { videoCategoryId: "2" }),
    en("Hyderabad cricket", { videoCategoryId: "17" }),
    te("Hyderabad daily vlog family"),
    en("Hyderabad education coaching", { videoCategoryId: "27" }),
  ],
  Visakhapatnam: [
    en("Visakhapatnam vlog"),
    en("Vizag vlog"),
    te("విశాఖపట్నం vlog"),
    en("Vizag food vlog"),
    en("Vizag beach travel", { videoCategoryId: "19" }),
    te("vizag telugu vlog"),
  ],
  Vijayawada: [
    en("Vijayawada vlog"),
    te("విజయవాడ vlog"),
    en("Vijayawada food vlog"),
    en("Vijayawada street food"),
    te("vijayawada telugu vlog"),
  ],
  Guntur: [en("Guntur vlog"), te("గుంటూరు vlog"), en("Guntur food vlog")],
  Tirupati: [en("Tirupati vlog"), te("తిరుపతి vlog"), en("Tirupati temple travel", { videoCategoryId: "19" })],
  Rajahmundry: [
    en("Rajahmundry vlog"),
    te("రాజమండ్రి vlog"),
    en("Rajahmundry food"),
    en("Rajamahendravaram"),
    te("రాజమండ్రి"),
    en("Rajahmundry street food"),
    te("Rajahmundry Godavari"),
    te("Rajahmundry telugu comedy"),
    en("Rajahmundry travel"),
    en("Rajahmundry shopping"),
    te("Rajahmundry daily vlog"),
    te("East Godavari vlog"),
  ],
  Kakinada: [en("Kakinada vlog"), te("కాకినాడ vlog"), en("Kakinada food")],
  Nellore: [en("Nellore vlog"), te("నెల్లూరు vlog"), en("Nellore food")],
  Kurnool: [en("Kurnool vlog"), te("కర్నూలు vlog")],
  Warangal: [en("Warangal vlog"), te("వరంగల్ vlog"), en("Warangal food"), te("warangal telugu vlog")],
  Karimnagar: [en("Karimnagar vlog"), te("కరీంనగర్ vlog")],
  Nizamabad: [en("Nizamabad vlog"), te("నిజామాబాద్ vlog")],
  Khammam: [en("Khammam vlog"), te("ఖమ్మం vlog")],
};

const top = (q: string, lang: string, extra: Partial<DiscoveryQuery> = {}): DiscoveryQuery => ({
  q,
  relevanceLanguage: lang,
  ...IN,
  ...extra,
  order: "viewCount",
});

/**
 * The same places ranked by view count: the biggest channels that keep making
 * content about them. Broad phrasings only — with view-count ranking a narrow
 * query returns the same few viral videos every time.
 */
export const TOP_PLACE_QUERIES: Record<string, DiscoveryQuery[]> = {
  Telugu: [
    top("telugu", "te"),
    top("telugu comedy", "te", { videoCategoryId: "23" }),
    top("telugu vlog", "te"),
    top("Andhra Pradesh", "te"),
    top("Telangana", "te"),
  ],
  Hyderabad: [
    top("Hyderabad", "en"),
    top("హైదరాబాద్", "te"),
    top("Hyderabad vlog", "en"),
    top("Hyderabad food", "en"),
    top("హైదరాబాద్ vlog", "te"),
    top("Hyderabadi", "en"),
    top("Hyderabad telugu", "te"),
    top("Hyderabad comedy", "en", { videoCategoryId: "23" }),
  ],
  Visakhapatnam: [top("Visakhapatnam", "en"), top("Vizag", "en"), top("విశాఖపట్నం", "te"), top("Vizag vlog", "en")],
  Vijayawada: [top("Vijayawada", "en"), top("విజయవాడ", "te"), top("Vijayawada vlog", "en")],
  Guntur: [top("Guntur", "en"), top("గుంటూరు", "te")],
  Tirupati: [top("Tirupati", "en"), top("తిరుపతి", "te")],
  Rajahmundry: [
    top("Rajahmundry", "en"),
    top("రాజమండ్రి", "te"),
    top("Rajamahendravaram", "te"),
    top("Rajahmundry vlog", "te"),
    top("Godavari", "te"),
    top("East Godavari", "te"),
  ],
  Warangal: [top("Warangal", "en"), top("వరంగల్", "te")],
};

/** Round-robin across places, so a budget that runs out still touched every city. */
export function interleave(lists: DiscoveryQuery[][]): DiscoveryQuery[] {
  const out: DiscoveryQuery[] = [];
  for (let i = 0; i < Math.max(...lists.map((list) => list.length)); i += 1) {
    for (const list of lists) if (list[i]) out.push(list[i]);
  }
  return out;
}

export const PLANS = {
  places: interleave(Object.values(PLACE_QUERIES)),
  top: interleave(Object.values(TOP_PLACE_QUERIES)),
} as const;
export type PlanName = keyof typeof PLANS;
