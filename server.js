const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();
app.use(cors());
app.use(express.json());

// Firebase Admin Initialization
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.database();

// 1. Student Login API
app.post('/api/login', async (req, res) => {
  const { name, code, deviceId } = req.body;
  if (!name || !code) return res.status(400).json({ success: false, message: 'Missing fields' });

  try {
    const studentRef = db.ref(`basic_level_students/${code}`);
    const snapshot = await studentRef.once('value');
    if (!snapshot.exists()) return res.json({ success: false, message: 'Invalid Access Code!' });

    const student = snapshot.val();
    if (student.name.toLowerCase() !== name.toLowerCase()) {
      return res.json({ success: false, message: 'Name does not match!' });
    }

    if (student.expiryTimestamp && Date.now() > student.expiryTimestamp) {
      return res.json({ success: false, message: 'Access Code Expired!' });
    }

    if (!student.boundDeviceId) {
      await studentRef.update({ boundDeviceId: deviceId });
    } else if (student.boundDeviceId !== deviceId) {
      return res.json({ success: false, message: 'Security Warning: Code bound to another device!' });
    }

    return res.json({ success: true, studentName: student.name, studentCode: code });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 2. Exam Submit API
app.post('/api/submit-exam', async (req, res) => {
  const { code, name, score } = req.body;
  if (!code) return res.status(400).json({ success: false, message: 'Missing code' });

  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const reportRef = db.ref(`basic_level_reports_set1/${code}`);
    const snap = await reportRef.once('value');
    let repData = snap.val() || {};
    let dailyScores = repData.dailyScores || [];

    if (repData.lastExamDate !== todayStr) dailyScores = [];
    dailyScores.push(score);

    await reportRef.update({
      name: name,
      lastScore: score,
      lastDate: new Date().toLocaleString(),
      lastExamDate: todayStr,
      dailyScores: dailyScores
    });

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Submit failed' });
  }
});

// 3. 👨‍🏫 TEACHER / ADMIN APIS (NEW & SECURE)

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const adminPass = process.env.ADMIN_PASSWORD || "sensei1997";
  if (password === adminPass) {
    return res.json({ success: true, message: 'Authenticated' });
  }
  return res.status(401).json({ success: false, message: 'Incorrect Password!' });
});

// Fetch Students & Reports
app.post('/api/admin/data', async (req, res) => {
  const { password } = req.body;
  const adminPass = process.env.ADMIN_PASSWORD || "sensei1997";
  if (password !== adminPass) return res.status(401).json({ success: false });

  try {
    const studentsSnap = await db.ref('basic_level_students').once('value');
    const reportsSnap = await db.ref('basic_level_reports_set1').once('value');
    return res.json({
      success: true,
      students: studentsSnap.val() || {},
      reports: reportsSnap.val() || {}
    });
  } catch (err) {
    return res.status(500).json({ success: false });
  }
});

// Add New Student
app.post('/api/admin/add-student', async (req, res) => {
  const { password, name, expiryTimestamp } = req.body;
  const adminPass = process.env.ADMIN_PASSWORD || "sensei1997";
  if (password !== adminPass) return res.status(401).json({ success: false });

  const code = 'BASIC-' + Math.floor(1000 + Math.random() * 9000);
  await db.ref(`basic_level_students/${code}`).set({
    name: name,
    code: code,
    boundDeviceId: null,
    expiryTimestamp: expiryTimestamp,
    createdDate: new Date().toLocaleDateString()
  });

  return res.json({ success: true, code, name });
});

// Reset Device Lock / Delete Student
app.post('/api/admin/manage-student', async (req, res) => {
  const { password, code, action } = req.body;
  const adminPass = process.env.ADMIN_PASSWORD || "sensei1997";
  if (password !== adminPass) return res.status(401).json({ success: false });

  if (action === 'reset') {
    await db.ref(`basic_level_students/${code}/boundDeviceId`).remove();
  } else if (action === 'delete') {
    await db.ref(`basic_level_students/${code}`).remove();
    await db.ref(`basic_level_reports_set1/${code}`).remove();
  }
  return res.json({ success: true });
});

module.exports = app;
