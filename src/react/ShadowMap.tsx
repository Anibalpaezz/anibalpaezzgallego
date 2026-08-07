import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type * as L from "leaflet";
import { getPosition, getTimes } from "suncalc";
import { translations } from "@/lib/translations";

type Lang = "es" | "en" | "fr" | "de" | "zh";

function tr(lang: Lang, key: string): string {
  let value: any = (translations[lang] as any) ?? translations.es;
  for (const k of key.split(".")) value = value?.[k];
  return typeof value === "string" ? value : key;
}

const DEFAULT_QUERY = "Calle Carretas, Ontígola, España";
const FALLBACK_COORDS: [number, number] = [40.4168, -3.7038];
const ZOOM = 15;
const RADIUS_M = 1000;

interface Place {
  lat: number;
  lng: number;
  name: string;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function nowTime(): string {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function toLocalTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function offsetLatLng(center: { lat: number; lng: number }, bearingDeg: number, meters: number): [number, number] {
  const b = (bearingDeg * Math.PI) / 180;
  const dLat = (meters * Math.cos(b)) / 111320;
  const dLng = (meters * Math.sin(b)) / (111320 * Math.cos((center.lat * Math.PI) / 180));
  return [center.lat + dLat, center.lng + dLng];
}

function shadowLengthMeters(altDeg: number): number {
  if (altDeg <= 0) return 0;
  const tanAlt = Math.tan((altDeg * Math.PI) / 180);
  if (tanAlt <= 0.02) return 700;
  return Math.min(700, 120 / tanAlt);
}

function compassBearing(azimuthRad: number): number {
  return (((azimuthRad * 180) / Math.PI) + 180) % 360;
}

export default function ShadowMap({ lang }: { lang: Lang }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  const [ready, setReady] = useState(false);
  const [coords, setCoords] = useState<[number, number]>(FALLBACK_COORDS);
  const [placeName, setPlaceName] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [date, setDate] = useState(todayLocal());
  const [time, setTime] = useState("12:00");

  async function searchAddress(q: string): Promise<Place[]> {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(
      q,
    )}&accept-language=${lang}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("geocode failed");
    const data: { lat: string; lon: string; display_name: string }[] = await res.json();
    return data.map((r) => ({ lat: +r.lat, lng: +r.lon, name: r.display_name }));
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;
      leafletRef.current = L;

      const makeIcons = () => ({
        target: L.divIcon({
          className: "shadowmap-divicon",
          iconSize: [34, 34],
          iconAnchor: [17, 34],
          html: `<div style="position:relative;width:34px;height:34px;">
    <svg width="34" height="34" viewBox="0 0 24 24" fill="hsl(var(--primary))" stroke="white" stroke-width="1.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5" fill="white" stroke="none"/></svg>
  </div>`,
        }),
        sun: L.divIcon({
          className: "shadowmap-divicon",
          iconSize: [30, 30],
          iconAnchor: [15, 15],
          html: `<svg width="30" height="30" viewBox="0 0 24 24" fill="hsl(45 100% 50%)"><circle cx="12" cy="12" r="4"/></svg>`,
        }),
      });

      const map = L.map(containerRef.current, {
        center: FALLBACK_COORDS,
        zoom: ZOOM,
        dragging: false,
        touchZoom: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        zoomControl: false,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      mapRef.current = map;
      layerGroupRef.current = L.layerGroup().addTo(map);
      markerRef.current = L.marker(FALLBACK_COORDS, {
        icon: makeIcons().target,
        interactive: false,
      }).addTo(map);
      circleRef.current = L.circle(FALLBACK_COORDS, {
        radius: RADIUS_M,
        color: "hsl(var(--primary))",
        weight: 2,
        dashArray: "4 6",
        fillColor: "hsl(var(--primary) / 0.06)",
        fillOpacity: 1,
        interactive: false,
      }).addTo(map);

      setReady(true);

      searchAddress(DEFAULT_QUERY)
        .then((list) => {
          if (list.length) {
            setCoords([list[0].lat, list[0].lng]);
            setPlaceName(list[0].name);
            setQuery(DEFAULT_QUERY);
          }
        })
        .catch(() => {});
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      leafletRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const group = layerGroupRef.current;
    const marker = markerRef.current;
    const circle = circleRef.current;
    if (!ready || !L || !map || !group || !marker || !circle) return;

    map.setView(coords, ZOOM, { animate: false });
    marker.setLatLng(coords);
    circle.setLatLng(coords);
    group.clearLayers();

    const [lat, lng] = coords;
    const when = new Date(`${date}T${time}:00`);
    const center = L.latLng(lat, lng);
    const pos = getPosition(when, lat, lng);
    const altDeg = (pos.altitude * 180) / Math.PI;
    const azDeg = compassBearing(pos.azimuth);
    const shadowBearing = (azDeg + 180) % 360;
    const times = getTimes(when, lat, lng);

    if (altDeg > 0) {
      const [slat, slng] = offsetLatLng(center, azDeg, RADIUS_M);
      L.marker(L.latLng(slat, slng), {
        icon: L.divIcon({
          className: "shadowmap-divicon",
          iconSize: [30, 30],
          iconAnchor: [15, 15],
          html: `<svg width="30" height="30" viewBox="0 0 24 24" fill="hsl(45 100% 50%)"><circle cx="12" cy="12" r="4"/></svg>`,
        }),
        interactive: false,
      }).addTo(group);
    }

    if (times.sunrise && times.sunset && times.sunrise.getTime() < times.sunset.getTime()) {
      const steps = 36;
      const points: L.LatLng[] = [];
      for (let i = 0; i <= steps; i++) {
        const tt = new Date(
          times.sunrise.getTime() +
            ((times.sunset.getTime() - times.sunrise.getTime()) * i) / steps,
        );
        const p = getPosition(tt, lat, lng);
        const altT = (p.altitude * 180) / Math.PI;
        const azT = compassBearing(p.azimuth);
        const shadowT = (azT + 180) % 360;
        const len = shadowLengthMeters(altT);
        if (len > 0) points.push(L.latLng(...offsetLatLng(center, shadowT, len)));
      }
      if (points.length >= 2) {
        L.polygon([...points, center], {
          color: "hsl(217 91% 60% / 0.4)",
          weight: 1,
          fillColor: "hsl(217 91% 60% / 0.18)",
          fillOpacity: 1,
          interactive: false,
        }).addTo(group);
      }
    }

    const len = shadowLengthMeters(altDeg);
    if (len > 0) {
      const shadowEnd = L.latLng(...offsetLatLng(center, shadowBearing, len));
      L.polyline([center, shadowEnd], {
        color: "hsl(var(--primary))",
        weight: 4,
        opacity: 0.85,
        interactive: false,
      }).addTo(group);
      L.circleMarker(shadowEnd, {
        radius: 5,
        color: "hsl(var(--primary))",
        weight: 2,
        fillColor: "white",
        fillOpacity: 1,
        interactive: false,
      }).addTo(group);
    }
  }, [ready, coords, date, time]);

  const handleSearch = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    searchAddress(query.trim())
      .then((list) => setResults(list))
      .catch(() => setResults([]))
      .finally(() => setSearching(false));
  };

  function pick(place: Place) {
    setCoords([place.lat, place.lng]);
    setPlaceName(place.name);
    setResults([]);
  }

  const when = new Date(`${date}T${time}:00`);
  const [lat, lng] = coords;
  const pos = getPosition(when, lat, lng);
  const altDeg = (pos.altitude * 180) / Math.PI;
  const azDeg = compassBearing(pos.azimuth);
  const times = getTimes(when, lat, lng);
  const isNight = altDeg <= 0;

  return (
    <div className="h-full flex flex-col rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-5 pb-3 space-y-1">
        <h3 className="text-xl font-bold tracking-tight">{tr(lang, "map.title")}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{tr(lang, "map.subtitle")}</p>
      </div>

      <div className="px-5 pb-3">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr(lang, "map.addressPlaceholder")}
            className="flex-1 min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-colors"
          />
          <button
            type="submit"
            disabled={searching}
            className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60 transition-colors"
          >
            {tr(lang, "map.search")}
          </button>
        </form>

        {results.length > 0 && (
          <ul className="mt-2 rounded-md border border-border bg-card shadow-lg divide-y divide-border max-h-52 overflow-auto">
            {results.map((r, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => pick(r)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors"
                >
                  {r.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="px-5 pb-3 flex flex-wrap gap-3 items-end">
        <label className="flex flex-col text-xs font-medium text-muted-foreground">
          {tr(lang, "map.date")}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-normal text-foreground outline-none focus:border-primary"
          />
        </label>
        <label className="flex flex-col text-xs font-medium text-muted-foreground">
          {tr(lang, "map.time")}
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-normal text-foreground outline-none focus:border-primary"
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setDate(todayLocal());
            setTime(nowTime());
          }}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-secondary transition-colors"
        >
          {tr(lang, "map.now")}
        </button>
      </div>

      <div className="px-5 pb-3 text-xs text-muted-foreground min-h-[1rem] truncate">{placeName}</div>

      <div ref={containerRef} className="relative z-0 mx-5 mb-3 h-[420px] lg:h-[520px] rounded-lg overflow-hidden" />

      <div className="px-5 pb-5 space-y-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-md border border-border bg-secondary/40 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">{tr(lang, "map.altitude")}</p>
            <p className="font-semibold">{altDeg.toFixed(1)}°</p>
          </div>
          <div className="rounded-md border border-border bg-secondary/40 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">{tr(lang, "map.azimuth")}</p>
            <p className="font-semibold">{azDeg.toFixed(0)}°</p>
          </div>
          <div className="rounded-md border border-border bg-secondary/40 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">{tr(lang, "map.sunrise")}</p>
            <p className="font-semibold">{times.sunrise ? toLocalTime(times.sunrise) : "—"}</p>
          </div>
          <div className="rounded-md border border-border bg-secondary/40 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">{tr(lang, "map.sunset")}</p>
            <p className="font-semibold">{times.sunset ? toLocalTime(times.sunset) : "—"}</p>
          </div>
        </div>
        {isNight && <p className="text-sm text-destructive font-medium">{tr(lang, "map.night")}</p>}
        <p className="text-[11px] text-muted-foreground">{tr(lang, "map.legend")}</p>
      </div>
    </div>
  );
}