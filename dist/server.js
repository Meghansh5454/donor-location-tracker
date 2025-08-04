"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const cors_1 = __importDefault(require("cors"));
const axios_1 = __importDefault(require("axios"));
const path_1 = __importDefault(require("path"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: [
        'http://localhost:3001',
        'http://localhost:3000',
        /https:\/\/.*\.devtunnels\.ms/, // Allow all devtunnel URLs
        /https:\/\/.*\.vercel\.app/, // Allow all Vercel URLs
        /https:\/\/.*\.onrender\.com/ // Allow all Render URLs
    ],
    credentials: true
}));
app.use(express_1.default.json());
// Serve static files from public folder
const publicPath = path_1.default.join(__dirname, '..', 'public');
app.use(express_1.default.static(publicPath));
mongoose_1.default.connect('mongodb+srv://meghanshthakker:sPJZneO8Bx29SJo8@raktmap.rjhcmrd.mongodb.net/raktmap');
const Location = mongoose_1.default.model('Location', new mongoose_1.default.Schema({
    address: String,
    latitude: Number,
    longitude: Number,
    accuracy: Number,
    timestamp: { type: Date, default: Date.now },
    userName: String,
    rollNumber: String,
    mobileNumber: String,
}));
// Haversine function
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const toRad = (deg) => deg * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.pow(Math.sin(dLon / 2), 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
const hospitalLat = 22.6023;
const hospitalLng = 72.8205;
const geofenceRadiusKm = 50;
app.post('/api/save-location', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { latitude, longitude, accuracy, userName, rollNumber, mobileNumber } = req.body;
        if (!latitude || !longitude)
            return res.status(400).json({ error: 'Coordinates required' });
        // Check geofence
        const distance = haversine(hospitalLat, hospitalLng, latitude, longitude);
        if (distance > geofenceRadiusKm) {
            return res.status(400).json({ error: 'Outside allowed area' });
        }
        // IP location cross-check
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const ipCheck = yield axios_1.default.get(`http://ip-api.com/json/${ip}?fields=lat,lon,proxy,hosting,status`);
        const ipData = ipCheck.data;
        if (ipData.proxy || ipData.hosting) {
            return res.status(400).json({ error: 'VPN/Proxy detected' });
        }
        const ipDistance = haversine(ipData.lat, ipData.lon, latitude, longitude);
        if (ipDistance > 200) {
            return res.status(400).json({ error: 'IP and GPS mismatch' });
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
            mobileNumber
        });
        yield loc.save();
        res.json({ message: 'Saved', accuracy, timestamp: loc.timestamp });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}));
// Serve the React app for the root route
app.get('/', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '..', 'public', 'index.html'));
});
// Handle any other routes by serving the React app
app.use((req, res) => {
    res.sendFile(path_1.default.join(__dirname, '..', 'public', 'index.html'));
});
app.listen(process.env.PORT || 3000, () => console.log(`Server running on ${process.env.PORT || 3000}`));
