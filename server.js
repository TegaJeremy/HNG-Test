const express = require('express');
const app = express();
const axios = require('axios');
const port = 2347;
app.use(express.json());



// Middleware to log the IP address
app.use((req, res, next) => {
    console.log('Client IP:', getClientIp(req));
    next();
});

// Function to get client IP address
function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    return forwarded ? forwarded.split(',').shift() : req.ip;
}

// Function to get location from IP address
async function getLocation(ip) {
    try {
        if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
            return 'Localhost'; // Fallback for localhost or private network IPs
        }

        const response = await axios.get(`http://ip-api.com/json/${ip}`);
        console.log('IP-API Response:', response.data);

        if (response.data && response.data.city) {
            return response.data.city;
        } else {
            console.error('Invalid response from IP-API:', response.data);
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
        console.log('OpenWeatherMap Response:', response.data);

        if (response.data && response.data.main && response.data.main.temp) {
            return response.data.main.temp;
        } else {
            console.error('Invalid response from OpenWeatherMap:', response.data);
            return 'Unknown temperature';
        }
    } catch (error) {
        console.error('Error fetching temperature from OpenWeatherMap:', error.message);
        return 'Unknown temperature';
    }
}

app.get('/api/hello', async (req, res) => {
    const visitorName = req.query.visitor_name || 'Guest';
    const clientIp = getClientIp(req);
    const location = await getLocation(clientIp);
    
    if (location === 'Unknown location' || location === 'Localhost') {
        // Handle fallback or error scenario
        res.status(404).json({
            client_ip: clientIp,
            location: location,
            greeting: `Hello, ${visitorName}! Unable to determine location.`
        });
        return;
    }

    const temperature = await getTemperature(location);

    if (temperature === 'Unknown temperature') {
        // Handle weather data error
        res.status(404).json({
            client_ip: clientIp,
            location: location,
            greeting: `Hello, ${visitorName}! Temperature data unavailable for ${location}.`
        });
        return;
    }

    res.json({
        client_ip: clientIp,
        location: location,
        greeting: `Hello, ${visitorName}! The temperature is ${temperature} degrees Celsius in ${location}`
    });
});

app.listen(port, () => {
    console.log(`App is listening on port ${port}`);
});
