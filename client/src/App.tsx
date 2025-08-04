// filepath: d:\Donor_Location\Donor_Location\client\src\App.tsx
import React from 'react';
import './App.css';

const getApiBaseUrl = () => {
  // Check if we're on a devtunnel URL
  if (window.location.hostname.includes('.devtunnels.ms')) {
    return '';
  }
  // Check if we're on Render
  if (window.location.hostname.includes('.onrender.com')) {
    return '';
  }
  // In development, React dev server runs on 3001, backend on 3000
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  return ''; // Use relative URLs in production
};
const API_BASE_URL = getApiBaseUrl();

function App() {
  const [result, setResult] = React.useState('');
  const [currentCoords, setCurrentCoords] = React.useState<{lat: number, lng: number, acc: number} | null>(null);
  const [userName, setUserName] = React.useState('');
  const [rollNumber, setRollNumber] = React.useState('');
  const [mobileNumber, setMobileNumber] = React.useState('');
  const [locationStatus, setLocationStatus] = React.useState<'getting' | 'success' | 'error' | 'denied'>('getting');

  // Auto-fetch location when component mounts
  React.useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setResult("❌ Geolocation not supported.");
      setLocationStatus('error');
      return;
    }

    setResult("📍 Getting your location...");
    setLocationStatus('getting');

    // Use getCurrentPosition with high accuracy for faster single reading
    navigator.geolocation.getCurrentPosition(
      pos => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          acc: pos.coords.accuracy
        };
        
        // If accuracy is good enough (< 50m), use it immediately
        if (coords.acc <= 50) {
          setCurrentCoords(coords);
          setLocationStatus('success');
          setResult(`
            <p>✅ Location captured successfully!</p>
            <p>Accuracy: ±${coords.acc.toFixed(2)} meters</p>
            <p>Please fill in your details below and submit.</p>
          `);
        } else {
          // If accuracy is poor, try one more time with watchPosition for better accuracy
          setResult("📍 Improving location accuracy...");
          
          const watchId = navigator.geolocation.watchPosition(
            pos2 => {
              const coords2 = {
                lat: pos2.coords.latitude,
                lng: pos2.coords.longitude,
                acc: pos2.coords.accuracy
              };
              
              // Use the better of the two readings
              const bestCoords = coords2.acc < coords.acc ? coords2 : coords;
              
              navigator.geolocation.clearWatch(watchId);
              setCurrentCoords(bestCoords);
              setLocationStatus('success');
              setResult(`
                <p>✅ Location captured successfully!</p>
                <p>Accuracy: ±${bestCoords.acc.toFixed(2)} meters</p>
                <p>Please fill in your details below and submit.</p>
              `);
            },
            err => {
              // If watch fails, use the first reading anyway
              navigator.geolocation.clearWatch(watchId);
              setCurrentCoords(coords);
              setLocationStatus('success');
              setResult(`
                <p>✅ Location captured!</p>
                <p>Accuracy: ±${coords.acc.toFixed(2)} meters</p>
                <p>Please fill in your details below and submit.</p>
              `);
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
          );
        }
      },
      err => {
        if (err.code === err.PERMISSION_DENIED) {
          setLocationStatus('denied');
          setResult(`❌ Location access denied. Please enable location services and refresh the page.`);
        } else {
          setLocationStatus('error');
          setResult(`❌ Error getting location: ${err.message}`);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const saveCurrentLocation = async () => {
    if (!userName.trim() || !rollNumber.trim() || !mobileNumber.trim()) {
      setResult("❌ Please fill in all details (Name, Roll Number, Mobile).");
      return;
    }
    
    if (!currentCoords) {
      setResult("❌ Location not available. Please refresh the page and allow location access.");
      return;
    }

    setResult("💾 Saving your location to database...");
    try {
      const res = await fetch(`${API_BASE_URL}/api/save-location`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          latitude: currentCoords.lat,
          longitude: currentCoords.lng,
          accuracy: currentCoords.acc,
          userName,
          rollNumber,
          mobileNumber
        })
      });
      const data = await res.json();
      if (data.error) {
        setResult(`❌ ${data.error}`);
      } else {
        setResult(`
          <p>✅ Successfully saved to database!</p>
          <p><strong>Name:</strong> ${userName}</p>
          <p><strong>Roll:</strong> ${rollNumber}</p>
          <p><strong>Mobile:</strong> ${mobileNumber}</p>
          <p><strong>Accuracy:</strong> ±${data.accuracy}m</p>
          <p>Thank you for submitting your location!</p>
        `);
        // Clear form after successful submission
        setUserName('');
        setRollNumber('');
        setMobileNumber('');
        setCurrentCoords(null);
      }
    } catch (err:any) {
      setResult(`❌ Error: ${err.message}`);
    }
  };

  return (
    <div className="App">
      <h1>📍 Donor Location Tracker</h1>
      
      {/* Location Status */}
      {locationStatus === 'getting' && (
        <div style={{background: '#fff3cd', padding: '15px', borderRadius: '8px', margin: '20px 0'}}>
          <h3>🔍 Detecting Your Location...</h3>
          <p>Please allow location access when prompted by your browser.</p>
        </div>
      )}
      
      {locationStatus === 'denied' && (
        <div style={{background: '#f8d7da', padding: '15px', borderRadius: '8px', margin: '20px 0'}}>
          <h3>❌ Location Access Required</h3>
          <p>This app needs your location to register your donation availability.</p>
          <button onClick={() => window.location.reload()}>🔄 Refresh & Try Again</button>
        </div>
      )}
      
      {locationStatus === 'success' && (
        <div style={{background: '#d1ecf1', padding: '15px', borderRadius: '8px', margin: '20px 0'}}>
          <h3>✅ Location Captured Successfully!</h3>
          <p>Please fill in your details below to complete registration.</p>
        </div>
      )}

      {/* Form - Only show when location is captured */}
      {locationStatus === 'success' && (
        <div style={{background: '#f8f9fa', padding: '20px', borderRadius: '10px', margin: '20px 0'}}>
          <h3>👤 Your Details</h3>
          <div style={{marginBottom: '15px'}}>
            <input 
              placeholder="Full Name" 
              value={userName} 
              onChange={e=>setUserName(e.target.value)}
              style={{width: '100%', padding: '12px', fontSize: '16px', borderRadius: '5px', border: '1px solid #ccc'}}
            />
          </div>
          <div style={{marginBottom: '15px'}}>
            <input 
              placeholder="Roll Number" 
              value={rollNumber} 
              onChange={e=>setRollNumber(e.target.value)}
              style={{width: '100%', padding: '12px', fontSize: '16px', borderRadius: '5px', border: '1px solid #ccc'}}
            />
          </div>
          <div style={{marginBottom: '20px'}}>
            <input 
              placeholder="Mobile Number" 
              value={mobileNumber} 
              onChange={e=>setMobileNumber(e.target.value)}
              style={{width: '100%', padding: '12px', fontSize: '16px', borderRadius: '5px', border: '1px solid #ccc'}}
            />
          </div>
          <button 
            onClick={saveCurrentLocation}
            disabled={!userName.trim() || !rollNumber.trim() || !mobileNumber.trim()}
            style={{
              width: '100%', 
              padding: '15px', 
              fontSize: '18px', 
              fontWeight: 'bold',
              backgroundColor: (!userName.trim() || !rollNumber.trim() || !mobileNumber.trim()) ? '#ccc' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: (!userName.trim() || !rollNumber.trim() || !mobileNumber.trim()) ? 'not-allowed' : 'pointer'
            }}
          >
            � Submit My Location
          </button>
        </div>
      )}

      {/* Result Display */}
      {result && (
        <div style={{background: '#f8f9fa', padding: '15px', borderRadius: '8px', margin: '20px 0'}}>
          <div dangerouslySetInnerHTML={{__html:result}} />
        </div>
      )}
    </div>
  );
}

export default App;
