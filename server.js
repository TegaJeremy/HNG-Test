const express = require('express');
const axios = require('axios');
const useragent = require('useragent');
const app = express();
const port = 2347;

app.use(express.json());

// Middleware to log the IP address and device type
app.use((req, res, next) => {
  console.log('Client IP:', getClientIp(req));
  const agent = useragent.parse(req.headers['user-agent']);
  console.log('Device Type:', agent.toString()); // Full user-agent details
  next();
});

// Function to get client IP address
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  return forwarded ? forwarded.split(',').shift() : req.ip;
}

// Function to get location from IP address using IP-API
async function getLocation(ip) {
  try {
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return 'Localhost'; // Fallback for localhost or private network IPs
    }

    const response = await axios.get(`https://ipapi.co/${ip}/json/`);
    if (response.data && response.data.city) {
      return {
        city: response.data.city,
        region: response.data.region,
        country: response.data.country_name,
        latitude: response.data.latitude,
        longitude: response.data.longitude
      };
    } else {
      return 'Unknown location';
    }
  } catch (error) {
    console.error('Error fetching location from IP-API:', error.message);
    return 'Unknown location';
  }
}

// Function to get the temperature for a given city
async function getTemperature(city) {
  try {
    const apiKey = 'ca31c53d5e925d5fed1e2d81c6f57acb'; // Replace with your OpenWeatherMap API key
    const response = await axios.get(`http://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${apiKey}`);
    if (response.data && response.data.main && response.data.main.temp) {
      return response.data.main.temp;
    } else {
      return 'Unknown temperature';
    }
  } catch (error) {
    console.error('Error fetching temperature:', error.message);
    return 'Unknown temperature';
  }
}

app.post('/api', async (req, res) => {
  const preciseLocation = req.body.preciseLocation;
  const visitorName = req.query.visitor_name || 'Guest';
  const clientIp = getClientIp(req);
  const location = await getLocation(clientIp);

  if (location === 'Unknown location' || location === 'Localhost') {
    res.status(404).json({
      client_ip: clientIp,
      location: location,
      greeting: `Hello, ${visitorName}! Unable to determine location.`
    });
    return;
  }

  const temperature = await getTemperature(location.city);

  if (temperature === 'Unknown temperature') {
    res.status(404).json({
      client_ip: clientIp,
      precise_location: preciseLocation,
      location: location,
      greeting: `Hello, ${visitorName}! Temperature data unavailable for ${location.city}.`
    });
    return;
  }

  const agent = useragent.parse(req.headers['user-agent']);
  res.json({
    client_ip: clientIp,
    location: location,
    precise_location: preciseLocation,
    temperature: temperature,
    device_details: {
      os: agent.os.toString(),
      browser: agent.toAgent(),
      device: agent.device.toString()
    },
    greeting: `Hello, ${visitorName}! The temperature is ${temperature} degrees Celsius in ${location.city}, ${location.region}, ${location.country}. You are currently located at ${preciseLocation}.`
  });
});

app.listen(port, () => {
  console.log(`App is listening on port ${port}`);
});