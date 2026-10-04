// server.js (Node.js Express Backend)
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();
app.use(cors());
app.use(express.json());

// Firebase Service Account configuration via Environment Variables
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.database();

// 1. Student Login Verification Route
app.post('/api/login', async (req, res) => {
  const { name, code, deviceId } = req.body;

  if (!name || !code || !deviceId) {
    return res.status(400).json({ success: false, message: "Name, Access Code, and Device ID are required!" });
  }

  try {
    const studentRef = db.ref(`basic_level_students/${code}`);
    const snapshot = await studentRef.once('value');

    if (!snapshot.exists()) {
      return res.status(404).json({ success: false, message: "Invalid Access Code! Please check with Sensei." });
    }

    const student = snapshot.val();

    if (student.name.toLowerCase() !== name.toLowerCase()) {
      return res.status(400).json({ success: false, message: "Name does not match with Access Code!" });
    }

    const now = Date.now();
    if (student.expiryTimestamp && now > student.expiryTimestamp) {
      return res.status(403).json({ success: false, message: `Access Code Expired on ${new Date(student.expiryTimestamp).toLocaleDateString()}.` });
    }

    // Device binding logic
    if (!student.boundDeviceId) {
      await studentRef.update({ boundDeviceId: deviceId });
    } else if (student.boundDeviceId !== deviceId) {
      return res.status(403).json({ success: false, message: "Security Warning: This Access Code is registered on another device." });
    }

    // Daily limit logic
    const todayStr = new Date().toISOString().split('T')[0];
    const reportRef = db.ref(`basic_level_reports_set5/${code}`);
    const repSnap = await reportRef.once('value');
    const repData = repSnap.val() || {};

    let currentCount = 0;
    if (repData.lastExamDate === todayStr && repData.dailyScores) {
      currentCount = repData.dailyScores.length;
    }

    if (currentCount >= 5) {
      return res.status(429).json({ success: false, message: "Daily Limit Reached: Maximum 5 attempts allowed per day." });
    }

    return res.json({ success: true, studentName: student.name, studentCode: code });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error during login." });
  }
});

// 2. Exam Submission & Score Recording Route
app.post('/api/submit-exam', async (req, res) => {
  const { code, name, score } = req.body;

  if (!code || !name || score === undefined) {
    return res.status(400).json({ success: false, message: "Missing score data." });
  }

  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const reportRef = db.ref(`basic_level_reports_set5/${code}`);
    const snap = await reportRef.once('value');
    let repData = snap.val() || {};
    let dailyScores = repData.dailyScores || [];

    if (repData.lastExamDate !== todayStr) {
      dailyScores = [];
    }

    dailyScores.push(score);

    await reportRef.update({
      name: name,
      lastScore: score,
      lastDate: new Date().toLocaleString(),
      lastExamDate: todayStr,
      dailyScores: dailyScores
    });

    return res.json({ success: true, message: "Score saved successfully." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error saving score." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Secure Server running on port ${PORT}`));
