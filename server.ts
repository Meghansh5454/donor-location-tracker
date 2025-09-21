import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import axios from 'axios';
import path from 'path';

const app = express();
app.use(cors({
  origin: [
    'http://localhost:3001', 
    'http://localhost:3000',
    /https:\/\/.*\.devtunnels\.ms/,  // Allow all devtunnel URLs
    /https:\/\/.*\.vercel\.app/,     // Allow all Vercel URLs
    /https:\/\/.*\.onrender\.com/    // Allow all Render URLs
  ],
  credentials: true
}));
app.use(express.json());

// Serve static files from public folder
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

mongoose.connect('mongodb+srv://meghanshthakker:sPJZneO8Bx29SJo8@raktmap.rjhcmrd.mongodb.net/raktmap');

const Location = mongoose.model('Location', new mongoose.Schema({
  address: String,
  latitude: Number,
  longitude: Number,
  accuracy: Number,
  timestamp: { type: Date, default: Date.now },
  userName: String,
  rollNumber: String,
  mobileNumber: String,
  donorId: { type: String, unique: true }, // Unique alphanumeric donor ID
  requestId: String, // Blood request ID from URL token
  token: String, // SMS token for verification
}));

// Generate unique donor ID (alphanumeric)
function generateUniqueId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return 'DON' + result; // e.g., DON4B7X9K2A
}

// Haversine function
function haversine(lat1:number, lon1:number, lat2:number, lon2:number) {
  const R = 6371; // km
  const toRad = (deg:number) => deg * Math.PI / 180;
  const dLat = toRad(lat2-lat1);
  const dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

const hospitalLat = 22.6023; 
const hospitalLng = 72.8205; 
const geofenceRadiusKm = 50; 

app.post('/api/save-location', async (req, res) => {
  try {
    const { latitude, longitude, accuracy, userName, rollNumber, mobileNumber, token, requestId } = req.body;

    if (!latitude || !longitude) return res.status(400).json({ error: 'Coordinates required' });

    // Check geofence
    const distance = haversine(hospitalLat, hospitalLng, latitude, longitude);
    if (distance > geofenceRadiusKm) {
      return res.status(400).json({ error: 'Outside allowed area' });
    }

    // IP location cross-check
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const ipCheck = await axios.get(`http://ip-api.com/json/${ip}?fields=lat,lon,proxy,hosting,status`);
    const ipData = ipCheck.data as any;
    if (ipData.proxy || ipData.hosting) {
      return res.status(400).json({ error: 'VPN/Proxy detected' });
    }
    const ipDistance = haversine(ipData.lat, ipData.lon, latitude, longitude);
    if (ipDistance > 200) {
      return res.status(400).json({ error: 'IP and GPS mismatch' });
    }

    // Generate unique donor ID
    let donorId = generateUniqueId();
    // Ensure uniqueness by checking database
    while (await Location.exists({ donorId })) {
      donorId = generateUniqueId();
    }

    // Create formatted address field
    const address = `${userName} (${rollNumber}) - Current Location: ${latitude}, ${longitude}`;
    
    const loc = new Location({ 
      address,
      latitude, 
      longitude, 
      accuracy, 
      userName, 
      rollNumber, 
      mobileNumber,
      donorId,
      requestId: requestId || null,
      token: token || null
    });
    await loc.save();
    
    // Return enhanced response with donor data for QR generation
    const qrData = {
      donorId,
      userName,
      rollNumber,
      mobileNumber,
      latitude,
      longitude,
      timestamp: loc.timestamp,
      requestId: requestId || null,
      token: token || null
    };
    
    res.json({ 
      message: 'Saved', 
      accuracy, 
      timestamp: loc.timestamp, 
      donorId,
      qrData 
    });
  } catch (err:any) {
    res.status(500).json({ error: err.message });
  }
});

// Serve the React app for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Handle any other routes by serving the React app
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(process.env.PORT || 3000, ()=>console.log(`Server running on ${process.env.PORT || 3000}`));
