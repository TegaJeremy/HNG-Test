const express = require('express');
const axios = require('axios');
const useragent = require('useragent');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const UserModel = require('./path-to-your-user-model');
const app = express();
const port = 2347;

app.use(express.json());

// Twilio setup
const twilioClient = twilio('ACa55558b53901df595fa41d3b10f155eaD', 'f0c45c37a7f87951af25096d9d9800b1');

// Nodemailer setup
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'your-email@gmail.com', // Replace with your email
        pass: 'your-email-password'   // Replace with your email password
    }
});

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

// Function to reverse geocode latitude and longitude to a more precise location
async function reverseGeocode(lat, lon) {
    try {
        const response = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=YOUR_GOOGLE_API_KEY`);
        if (response.data && response.data.results && response.data.results.length > 0) {
            return response.data.results[0].formatted_address;
        } else {
            return 'Unknown precise location';
        }
    } catch (error) {
        console.error('Error fetching precise location:', error.message);
        return 'Unknown precise location';
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

// Function to send distress messages
async function sendDistressMessages(user, preciseLocation) {
    const subject = "Emergency Alert: Immediate Attention Required!";
    const message = `
        <h1>Distress Alert!</h1>
        <p>The user ${user.fullName} is in danger. Please contact them immediately.</p>
        <p><b>Location:</b> ${preciseLocation}</p>
        <p><b>Phone Number:</b> ${user.phoneNumber}</p>
        <p><b>Email:</b> ${user.email}</p>
        <img src="${user.profilePic}" alt="Profile Picture" width="100" />
    `;

    // Send email to each emergency contact
    user.EmergencyEmails.forEach(async (contact) => {
        try {
            await transporter.sendMail({
                from: '"Emergency Alert" <your-email@gmail.com>',
                to: contact.email,
                subject: subject,
                html: message
            });
            console.log(`Email sent to ${contact.email}`);
        } catch (error) {
            console.error(`Error sending email to ${contact.email}:`, error.message);
        }
    });

    // Send SMS to each emergency contact
    user.EmergencyPhoneNumbers.forEach(async (contact) => {
        try {
            await twilioClient.messages.create({
                body: `Distress Alert! The user ${user.fullName} is in danger. Location: ${preciseLocation}. Please contact them immediately.`,
                from: 'Your-Twilio-Number',  // Replace with your Twilio number
                to: contact.number
            });
            console.log(`SMS sent to ${contact.number}`);
        } catch (error) {
            console.error(`Error sending SMS to ${contact.number}:`, error.message);
        }
    });
}

// Endpoint to trigger distress message
app.post('/api/distress', async (req, res) => {
    const { userId } = req.body;

    // Fetch user from the database
    const user = await UserModel.findById(userId);
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    const clientIp = getClientIp(req);
    const location = await getLocation(clientIp);
    const preciseLocation = await reverseGeocode(location.latitude, location.longitude);

    // Send distress messages
    await sendDistressMessages(user, preciseLocation);

    res.json({ message: 'Distress messages sent successfully' });
});

app.listen(port, () => {
    console.log(`App is listening on port ${port}`);
});
