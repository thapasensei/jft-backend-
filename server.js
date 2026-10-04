const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// 1. TEACHER LOGIN ENDPOINT
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;

    const envUser = process.env.ADMIN_USERNAME || 'thapasensei';
    const envPass = process.env.ADMIN_PASSWORD;

    // यदि पासवर्ड Vercel को ADMIN_PASSWORD सँग मिल्यो भने success
    if (password === envPass) {
        return res.json({ success: true, message: 'Teacher Login Successful' });
    } else {
        return res.status(401).json({ success: false, message: 'Invalid Admin Password' });
    }
});

// 2. FETCH DASHBOARD DATA
app.post('/api/admin/data', (req, res) => {
    const { password } = req.body;
    const envPass = process.env.ADMIN_PASSWORD;

    if (password === envPass) {
        return res.json({
            success: true,
            students: {},
            reports: {}
        });
    } else {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
});

// 3. STUDENT EXAM LOGIN
app.post('/api/login', (req, res) => {
    const { name, code, deviceId } = req.body;
    if (!name || !code) {
        return res.status(400).json({ success: false, message: 'Name and Code are required' });
    }
    return res.json({
        success: true,
        studentName: name,
        studentCode: code
    });
});

// 4. MANUAL STUDENT LOGIN
app.post('/api/manual-login', (req, res) => {
    const { name, email } = req.body;
    if (!name || !email) {
        return res.status(400).json({ success: false, message: 'Name and Email required' });
    }
    return res.json({ success: true, message: 'Login Success' });
});

// HEALTH CHECK
app.get('/', (req, res) => {
    res.send('JFT Backend Server is running smoothly!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
