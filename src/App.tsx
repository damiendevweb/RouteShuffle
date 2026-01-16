import { useState, useRef, useEffect } from 'react'
import { Helmet } from 'react-helmet';
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'

interface Loop {
  id: number
  address: string
  distance: number
  unit: string
  actualDistance: string
  color: string
  polyline: L.Polyline
}

function App() {
  const [address, setAddress] = useState('')
  const [distance, setDistance] = useState('5')
  const [loops, setLoops] = useState<Loop[]>([])
  const [message, setMessage] = useState('')
  const mapRef = useRef<L.Map>(null)
  const mapDivRef = useRef<HTMLDivElement>(null)
  const clickMarkerRef = useRef<L.Marker>(null)

  useEffect(() => {
    if (mapDivRef.current && !mapRef.current) {
      mapDivRef.current.innerHTML = ''
      const map = L.map(mapDivRef.current).setView([47.7484, -3.3700], 15)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map)
           
      map.on('click', async (e) => {
        const { lat, lng } = e.latlng
        if (clickMarkerRef.current) {
          map.removeLayer(clickMarkerRef.current)
        }
        
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`
        )
        const data = await res.json()
        
        const addr = data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
        setAddress(addr)
        
        clickMarkerRef.current = L.marker([lat, lng])
          .addTo(map)
          .bindPopup(`<b>${addr}</b>`)
          .openPopup()
      })
      
      mapRef.current = map
    
    }
  }, [])

  const geocodeAddress = async (addr: string) => {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr)}&format=json`)
    const data = await res.json()
    if (data.length === 0) return null
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon)
    }
  }

  const generateLoopRoute = async (lat: number, lng: number, targetDistanceKm: number) => {
  const numPoints = 5 + Math.floor(Math.random() * 5) // 5-9
  const baseRadius = (targetDistanceKm * 0.5) / (2 * Math.PI) / 111
  const startAngle = Math.random() * 2 * Math.PI
  const waypoints = [[lng, lat]]
  
  for (let i = 0; i < numPoints; i++) {
    const angleVariation = (i / numPoints) * 2 * Math.PI + startAngle
    const radiusVariation = baseRadius * (0.6 + Math.random() * 0.8) // 60-140%
    const waveVariation = Math.sin(i * 0.7) * 0.2 * baseRadius
    
    waypoints.push([
      lng + (radiusVariation + waveVariation) * Math.cos(angleVariation),
      lat + (radiusVariation + waveVariation) * Math.sin(angleVariation)
    ])
  }
    
    waypoints.push([lng, lat])

    const coords = waypoints.map(w => w.join(',')).join(';')
    const url = `https://router.project-osrm.org/route/v1/foot-walking/${coords}?overview=full&geometries=geojson`

    const res = await fetch(url)
    const data = await res.json()
    if (!data.routes?.[0]) return null

    const route = data.routes[0]
    return {
      coords: route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]),
      distance: (route.distance / 1000).toFixed(2)
    }
  }

  const addLoop = async () => {
    const coords = await geocodeAddress(address)
    if (!coords || !mapRef.current) {
      setMessage('❌ Adresse non trouvée')
      return
    }

    const distKm = parseFloat(distance)
    console.log(distKm);
    const route = await generateLoopRoute(coords.lat, coords.lng, distKm)
    if (!route || !mapRef.current) return

    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b']
    const color = colors[loops.length % colors.length]
  
    const polyline = L.polyline(route.coords, { color, weight: 4 }).addTo(mapRef.current)
    mapRef.current.fitBounds(polyline.getBounds())
  
    setLoops([...loops, {
      id: Date.now(),
      address,
      distance: parseFloat(distance),
      unit: 'km',
      actualDistance: route.distance,
      color,
      polyline
    }])
  }

  return (
    <>
      <Helmet>
        <title>Route Shuffle</title>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🗺️</text></svg>" />
        <meta name="description" content="Generate your own loop !" />
      </Helmet>
      <div className="main-page">
        <div className="sidebar">
          <h1>🗺️ Route Loop Generator</h1>
          <input 
            value={address} 
            onChange={(e) => setAddress(e.target.value)} 
            placeholder="Adresse (ex: Paris, France)"
          />
          <input 
            type="number" 
            value={distance} 
            onChange={(e) => setDistance(e.target.value)} 
            placeholder="Distance"
            min="1" max="50" step="0.5"
          />

          <button className="add-btn" onClick={addLoop}>
            Générer 1 boucle de {distance} km
          </button>
          <div className="status">{message}</div>
          <div className="loops-count">📍 Boucles: {loops.length}</div>
          <div className="loops-list">
            {loops.slice(-6).map(loop => (
              <div key={loop.id} className="loop-item" style={{ borderLeftColor: loop.color }}>
                <div>
                  <div className="loop-title">{loop.address}</div>
                  <div className="loop-distances">
                    🎯 {loop.distance.toFixed(1)}km → 📏 {loop.actualDistance}km
                  </div>
                </div>
                <div className="loop-color" style={{ backgroundColor: loop.color }}></div>
              </div>
            ))}
          </div>
        </div>
        <div className="map-container" ref={mapDivRef} />
      </div>
    </>
  )
}

export default App
