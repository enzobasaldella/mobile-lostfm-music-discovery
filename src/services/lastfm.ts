import Constants from 'expo-constants';

const API_ROOT = 'https://ws.audioscrobbler.com/2.0/';
const MUSICBRAINZ_ROOT = 'https://musicbrainz.org/ws/2/artist/';
// Regional scenes broaden discovery. A tag is not proof of an artist's origin.
const SCENE_TAGS = [
  'brazilian', 'japanese', 'korean indie', 'turkish', 'arabic', 'nigerian',
  'ethiopian', 'indonesian', 'thai', 'french', 'italian', 'german',
  'indian', 'balkan', 'cumbia', 'argentinian', 'south african',
  'portuguese', 'icelandic', 'swedish', 'african', 'city pop',
];
const GEOGRAPHIC_TAGS = new Set([
  'brazilian', 'japanese', 'korean', 'turkish', 'arabic', 'nigerian',
  'ethiopian', 'indonesian', 'thai', 'french', 'italian', 'german',
  'indian', 'balkan', 'argentinian', 'south african', 'portuguese',
  'icelandic', 'swedish', 'african',
]);
const MAX_LISTENERS = 350_000;
const originCache = new Map<string, string | null>();
let lastOriginRequest = 0;

type LastFmImage = { '#text'?: string; size?: string };
type LastFmTrack = {
  name: string;
  artist: { name: string; mbid?: string } | string;
  url?: string;
  duration?: string | number;
  image?: LastFmImage[];
};
type TopTracksResponse = {
  error?: number;
  message?: string;
  tracks?: { track?: LastFmTrack[]; '@attr'?: { tag?: string } };
};
type TrackInfoResponse = {
  track?: {
    duration?: string | number;
    listeners?: string | number;
    artist?: { mbid?: string };
    album?: { image?: LastFmImage[] };
    toptags?: { tag?: { name?: string }[] };
  };
};

/** Data passed from the discovery service to the UI and local favorites. */
export type SongPick = {
  title: string;
  artist: string;
  url: string;
  artworkUrl?: string;
  durationMs?: number;
  genres: string[];
  genre?: string; // Older saved tracks used a single genre.
  scene?: string; // Last.fm chart tag, also used when track-level tags are missing.
  artistCountry?: string;
};

/** Last.fm durations are milliseconds; zero or invalid values mean unavailable. */
function validDuration(value: string | number | undefined): number | undefined {
  const milliseconds = Number(value);
  return Number.isFinite(milliseconds) && milliseconds > 0 ? milliseconds : undefined;
}

/** Prefer the largest usable cover URL in Last.fm's image list. */
function largestImage(images: LastFmImage[] | undefined): string | undefined {
  return images?.find((image) => image.size === 'extralarge' && image['#text'])?.['#text']
    || images?.find((image) => image.size === 'large' && image['#text'])?.['#text'];
}

/** Select one tag from a non-empty list using a random index. */
function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/** Normalize, deduplicate, and limit tags; use the chart scene if details are absent. */
function cleanGenres(names: (string | undefined)[], fallback: string): string[] {
  const genres = names
    .filter((name): name is string => !!name)
    .map((name) => name.replace(/^#+/, '').replace(/_/g, ' ').trim())
    .filter((name) => name.length > 1 && name.length < 25 && !/^(music|seen live|favorites|favorite)$/i.test(name));
  const safeFallback = fallback ? [fallback] : [];
  return [...new Set(genres.length ? genres : safeFallback)].slice(0, 3);
}

/** Hide redundant location tags unless that would leave the result without a tag. */
export function visibleGenres(song: SongPick): string[] {
  const tags = cleanGenres(song.genres?.length ? song.genres : song.genre ? [song.genre] : [], '');
  if (!song.artistCountry) return tags;
  const nonGeographic = tags.filter((tag) => !GEOGRAPHIC_TAGS.has(tag.toLowerCase()));
  // The chart tag comes from Last.fm and remains visible when track tags are only geographic.
  return nonGeographic.length ? nonGeographic : song.scene ? [song.scene] : tags;
}

/** Look up an artist's country by MBID; cache and rate-limit this optional request. */
async function getArtistCountry(mbid?: string): Promise<string | undefined> {
  if (!mbid || !/^[a-f0-9-]{36}$/i.test(mbid)) return undefined;
  if (originCache.has(mbid)) return originCache.get(mbid) || undefined;
  try {
    // MusicBrainz asks clients to stay below one request/second and identify themselves.
    const pause = Math.max(0, 1100 - (Date.now() - lastOriginRequest));
    if (pause) await new Promise((resolve) => setTimeout(resolve, pause));
    lastOriginRequest = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    try {
      const response = await fetch(`${MUSICBRAINZ_ROOT}${mbid}?fmt=json`, {
        headers: { 'User-Agent': 'LostfmMobile/1.0.2 (https://github.com/enzobasaldella/mobile-lostfm-music-discovery)' },
        signal: controller.signal,
      });
      if (!response.ok) return undefined;
      const artist = (await response.json()) as { country?: string; area?: { name?: string; 'iso-3166-1-codes'?: string[] } };
      if (!artist.country) { originCache.set(mbid, null); return undefined; }
      let country = artist.area?.['iso-3166-1-codes']?.includes(artist.country) ? artist.area.name || artist.country : artist.country;
      try { country = new Intl.DisplayNames(['en'], { type: 'region' }).of(artist.country) || country; }
      catch { /* Older Android runtimes may not include Intl.DisplayNames. */ }
      originCache.set(mbid, country);
      return country;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    // Country is supplementary; a MusicBrainz failure must not block discovery.
    return undefined;
  }
}

/** Query a regional Last.fm chart, enrich candidates, and return one display-ready song. */
export async function getSurpriseSong(excludeUrl?: string): Promise<SongPick> {
  const apiKey = Constants.expoConfig?.extra?.lastFmApiKey as string | undefined;
  if (!apiKey) throw new Error('The Last.fm API key is not configured.');

  const tag = randomItem(SCENE_TAGS);
  const page = String(2 + Math.floor(Math.random() * 4));
  const params = new URLSearchParams({ method: 'tag.gettoptracks', tag, limit: '50', page, api_key: apiKey, format: 'json' });
  const response = await fetch(`${API_ROOT}?${params.toString()}`);
  if (!response.ok) throw new Error(`Last.fm returned status ${response.status}.`);
  let data = (await response.json()) as TopTracksResponse;
  if (data.error) throw new Error(data.message || 'Last.fm could not find tracks right now.');
  // Some tags have fewer chart pages than requested; page two is the first fallback.
  if (!data.tracks?.track?.length && page !== '2') {
    params.set('page', '2');
    const fallback = await fetch(`${API_ROOT}?${params.toString()}`);
    if (fallback.ok) data = (await fallback.json()) as TopTracksResponse;
  }

  // A usable result needs a title, artist, and link, and should differ from the last pick.
  const candidates = (data.tracks?.track ?? []).filter(
    (track) => track.name && track.url && track.url !== excludeUrl &&
      (typeof track.artist === 'string' ? track.artist : track.artist?.name),
  );
  if (!candidates.length) throw new Error('No tracks were returned. Please try again.');
  const scene = data.tracks?.['@attr']?.tag || tag;

  let best: { song: SongPick; listeners: number; mbid?: string } | undefined;
  // Inspect at most four candidates and keep the least popular usable fallback.
  for (let attempt = 0; attempt < Math.min(4, candidates.length); attempt++) {
    const index = Math.floor(Math.random() * candidates.length);
    const track = candidates.splice(index, 1)[0];
    const artist = typeof track.artist === 'string' ? track.artist : track.artist.name;
    const song: SongPick = {
      title: track.name,
      artist,
      url: track.url!,
      artworkUrl: largestImage(track.image),
      durationMs: validDuration(track.duration),
      genres: cleanGenres([], scene),
      scene,
    };
    let listeners = Number.POSITIVE_INFINITY;
    let mbid = typeof track.artist === 'string' ? undefined : track.artist.mbid;
    try {
      // track.getInfo can add cover, duration, tags, listener count, and artist MBID.
      const infoParams = new URLSearchParams({ method: 'track.getInfo', artist, track: track.name, api_key: apiKey, format: 'json' });
      const infoResponse = await fetch(`${API_ROOT}?${infoParams.toString()}`);
      if (infoResponse.ok) {
        const details = (await infoResponse.json()) as TrackInfoResponse;
        const info = details.track;
        song.artworkUrl = largestImage(info?.album?.image) || song.artworkUrl;
        song.durationMs = validDuration(info?.duration) || song.durationMs;
        song.genres = cleanGenres(info?.toptags?.tag?.map((item) => item.name) || [], scene);
        mbid = info?.artist?.mbid || mbid;
        const count = Number(info?.listeners);
        if (Number.isFinite(count) && count > 0) listeners = count;
      }
    } catch {
      // The chart result still provides a usable title, artist, and Last.fm link.
    }
    if (!best || listeners < best.listeners) best = { song, listeners, mbid };
    if (listeners <= MAX_LISTENERS) break;
  }

  const selected = best!;
  // Country is supplementary: a missing MBID or failed lookup leaves the song usable.
  selected.song.artistCountry = await getArtistCountry(selected.mbid);
  return selected.song;
}
