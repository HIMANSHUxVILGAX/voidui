import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface ThreatPin {
  ip: string
  location: string
  countryCode: string
  service: string
  summary: string
  lat: number
  lon: number
}

interface ThreatMapProps {
  pins: ThreatPin[]
}

// Known IP/location to real-world lat/lon coordinates
export function resolveLatLon(ipStr: string, locationStr: string): { lat: number; lon: number } {
  const ip = ipStr || '127.0.0.1'
  const loc = (locationStr || '').toLowerCase()

  if (loc.includes('jaipur') || loc.includes('rajasthan')) return { lat: 26.9136, lon: 75.7858 }
  if (loc.includes('delhi')) return { lat: 28.61, lon: 77.21 }
  if (loc.includes('mumbai')) return { lat: 19.08, lon: 72.88 }
  if (loc.includes('bengaluru') || loc.includes('bangalore')) return { lat: 12.97, lon: 77.59 }
  if (loc.includes('india') || ip === '127.0.0.1' || ip === '::1') return { lat: 26.9136, lon: 75.7858 }
  if (loc.includes('frankfurt') || loc.includes('germany') || ip === '185.220.101.5')
    return { lat: 50.11, lon: 8.68 }
  if (loc.includes('moscow') || loc.includes('russia') || ip === '185.220.101.33')
    return { lat: 55.7558, lon: 37.6173 }
  if (loc.includes('beijing') || loc.includes('china') || ip === '203.0.113.77')
    return { lat: 39.9042, lon: 116.4074 }
  if (
    loc.includes('são paulo') ||
    loc.includes('sao paulo') ||
    loc.includes('brazil') ||
    ip === '45.33.32.156'
  )
    return { lat: -23.5505, lon: -46.6333 }
  if (loc.includes('tokyo') || loc.includes('japan') || ip === '103.21.244.2')
    return { lat: 35.68, lon: 139.69 }
  if (
    loc.includes('london') ||
    loc.includes('uk') ||
    loc.includes('united kingdom') ||
    ip === '198.51.100.42'
  )
    return { lat: 51.51, lon: -0.13 }
  if (ip === '104.248.29.91' || loc.includes('new york')) return { lat: 40.7128, lon: -74.006 }
  if (loc.includes('sydney') || loc.includes('australia')) return { lat: -33.87, lon: 151.21 }

  return { lat: 26.9136, lon: 75.7858 }
}

const ThreatMap: React.FC<ThreatMapProps> = ({ pins = [] }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.CircleMarker[]>([])
  const prevPinsRef = useRef<string>('')

  // Initialize Leaflet map safely once
  useEffect((): void | (() => void) => {
    if (!mapContainerRef.current) return

    // If map instance already exists, do not re-initialize
    if (mapInstanceRef.current) return

    // Force clear any stale Leaflet ID on DOM element
    if ((mapContainerRef.current as any)._leaflet_id) {
      delete (mapContainerRef.current as any)._leaflet_id
    }

    try {
      // Initialize map
      const map = L.map(mapContainerRef.current, {
        center: [26.9136, 75.7858],
        zoom: 3,
        minZoom: 1,
        maxZoom: 18,
        zoomControl: true,
        attributionControl: false,
        scrollWheelZoom: true,
        dragging: true
      })

      // Clean OpenStreetMap Dark Filtered tiles without watermark or API key
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        className: 'cyber-dark-tiles',
        maxZoom: 19
      }).addTo(map)

      // Force Leaflet to recalculate container bounds after mount
      setTimeout(() => {
        try {
          map.invalidateSize()
        } catch (e) { }
      }, 300)

      mapInstanceRef.current = map
    } catch (err) {
      console.warn('Leaflet map init warning:', err)
    }

    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove()
        } catch (e) { }
        mapInstanceRef.current = null
      }
    }
  }, [])

  // Update markers when pins change
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    const pinsStr = JSON.stringify(pins)
    if (pinsStr === prevPinsRef.current) return
    prevPinsRef.current = pinsStr

    // Clear old markers
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    // Add new markers
    for (const pin of pins || []) {
      if (!pin) continue

      let lat = typeof pin.lat === 'number' && !isNaN(pin.lat) ? pin.lat : 0
      let lon = typeof pin.lon === 'number' && !isNaN(pin.lon) ? pin.lon : 0

      if (lat === 0 && lon === 0) {
        const coords = resolveLatLon(pin.ip, pin.location)
        lat = coords.lat
        lon = coords.lon
      }

      const ip = pin.ip || '127.0.0.1'
      const location = pin.location || 'Local Network'
      const countryCode = pin.countryCode || 'GLOBAL'
      const service = pin.service || 'Web Decoy'
      const summary = pin.summary || 'Active intrusion trapped.'

      // Outer pulsing ring
      const pulseRing = L.circleMarker([lat, lon], {
        radius: 16,
        color: '#f43f5e',
        fillColor: '#f43f5e',
        fillOpacity: 0.35,
        weight: 2,
        interactive: false,
        className: 'threat-pulse-ring'
      }).addTo(map)

      // Inner solid dot
      const dot = L.circleMarker([lat, lon], {
        radius: 7,
        color: '#0f172a',
        fillColor: '#ef4444',
        fillOpacity: 1,
        weight: 2
      }).addTo(map)

      // Helper to prevent XSS injection in Leaflet popups
      const escapeHtml = (str: string): string =>
        String(str).replace(
          /[&<>"']/g,
          (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m] || m
        )

      const safeIp = escapeHtml(ip)
      const safeLocation = escapeHtml(location)
      const safeCountryCode = escapeHtml(countryCode)
      const safeService = escapeHtml(service)
      const safeSummary = escapeHtml(summary)

      // Popup on click / hover
      dot.bindPopup(
        `<div style="font-family:monospace;font-size:11px;line-height:1.6;color:#e2e8f0;">
          <strong style="color:#f43f5e;font-size:12px;">INTRUDER: ${safeIp}</strong><br/>
          <span style="color:#fbbf24;">${safeLocation} (${safeCountryCode})</span><br/>
          <span style="color:#34d399;">Target Port: ${safeService}</span><br/>
          <p style="color:#cbd5e1;font-size:10px;margin-top:4px;border-top:1px solid #334155;padding-top:4px;">
            ${safeSummary}
          </p>
        </div>`,
        { className: 'optics-theme-popup' }
      )

      markersRef.current.push(pulseRing, dot)
    }
  }, [pins])

  return (
    <div className="relative w-full">
      <div id="optics-map-container" ref={mapContainerRef} />

      {/* Clean Slate Theme CSS matching App UI */}
      <style>{`
        #optics-map-container {
          width: 100%;
          height: 350px;
          border-radius: 12px;
          border: 1px solid #1e293b;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
          background: #020617;
          z-index: 1;
        }
        .cyber-dark-tiles {
          filter: brightness(0.6) invert(1) contrast(3) hue-rotate(200deg) saturate(0.2) brightness(0.65) !important;
        }
        .threat-pulse-ring {
          animation: threat-pulse 1.8s ease-in-out infinite;
        }
        @keyframes threat-pulse {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.6; }
        }
        .optics-theme-popup .leaflet-popup-content-wrapper {
          background: rgba(15, 23, 42, 0.95) !important;
          border: 1px solid #334155 !important;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5) !important;
          border-radius: 8px !important;
          color: #e2e8f0 !important;
        }
        .optics-theme-popup .leaflet-popup-tip {
          background: rgba(15, 23, 42, 0.95) !important;
          border: 1px solid #334155 !important;
        }
        .leaflet-container {
          background: #020617 !important;
          font-family: inherit;
        }
        .leaflet-control-attribution {
          display: none !important;
        }
        .leaflet-control-zoom a {
          background: #0f172a !important;
          color: #94a3b8 !important;
          border-color: #334155 !important;
        }
        .leaflet-control-zoom a:hover {
          background: #1e293b !important;
          color: #f8fafc !important;
        }
      `}</style>
    </div>
  )
}

export default ThreatMap
