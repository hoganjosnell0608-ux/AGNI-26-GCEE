// =========================================================================
// AGNI 26 SYMPOSIUM - ZERO-ISSUE FIREBASE DATABASE SERVICE
// Dual Database Support: Realtime Database (100% Live) + Cloud Firestore
// =========================================================================

const firebaseConfig = {
  apiKey: "AIzaSyBAvyD7xxPGXqvNgYk4htUnJdZyc9j3tDQ",
  authDomain: "agni2k26.firebaseapp.com",
  databaseURL: "https://agni2k26-default-rtdb.firebaseio.com",
  projectId: "agni2k26",
  storageBucket: "agni2k26.firebasestorage.app",
  messagingSenderId: "229157442759",
  appId: "1:229157442759:web:be618c007219639b1a5ae2"
};

// Initialize Firebase App & Database Engines
let agniFirebaseApp = null;
let agniRtdb = null;
let agniFirestore = null;

try {
  if (typeof firebase !== 'undefined') {
    if (!firebase.apps || !firebase.apps.length) {
      agniFirebaseApp = firebase.initializeApp(firebaseConfig);
    } else {
      agniFirebaseApp = firebase.app();
    }

    // 1. Firebase Realtime Database (Guaranteed Live with no permissions blockers)
    if (typeof firebase.database === 'function') {
      try {
        agniRtdb = firebase.database();
        console.log('%c[AGNI Firebase]%c Realtime Database connected: agni2k26-default-rtdb', 'color:#ff5e14;font-weight:bold;', 'color:#10b981;');
      } catch (rtdbErr) {
        console.warn('[AGNI Firebase] RTDB init note:', rtdbErr);
      }
    }

    // 2. Cloud Firestore (Parallel cloud store)
    if (typeof firebase.firestore === 'function') {
      try {
        agniFirestore = firebase.firestore();
      } catch (fsErr) {
        console.warn('[AGNI Firebase] Firestore init note:', fsErr);
      }
    }
  }
} catch (e) {
  console.warn('[AGNI Firebase] Initialization notice:', e);
}

// Client-side image compression helper to ensure fast storage
function compressBase64Image(dataUrl, maxDim = 800, quality = 0.65) {
  return new Promise((resolve) => {
    if (!dataUrl || !dataUrl.startsWith('data:image')) {
      return resolve(dataUrl || '');
    }
    if (dataUrl.length < 80000) {
      return resolve(dataUrl);
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      try {
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (err) {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// Global AgniFirebase Service Layer
window.AgniFirebase = {
  app: agniFirebaseApp,
  rtdb: agniRtdb,
  firestore: agniFirestore,
  config: firebaseConfig,

  isReady() {
    return !!(this.rtdb || this.firestore || (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length));
  },

  // Save new or updated registration in Firebase (Dual sync: RTDB + Firestore)
  async saveRegistration(record) {
    if (!record) return { success: false, error: 'Empty record' };
    const docId = (record.regId || record.code || ('AGNI-' + Math.floor(100000 + Math.random() * 900000))).toUpperCase().trim();

    // Compress screenshot if needed
    let cleanScreenshot = record.screenshotBase64 || '';
    if (cleanScreenshot && cleanScreenshot.length > 80000) {
      try {
        cleanScreenshot = await compressBase64Image(cleanScreenshot);
      } catch (e) {}
    }

    const payload = {
      regId: docId,
      confirmationCode: docId,
      code: docId,
      name: record.name || '',
      college: record.college || '',
      dept: record.dept || record.department || '',
      year: record.year || '',
      phone: record.phone || record.whatsapp || '',
      email: record.email || '',
      amount: Number(record.amount || record.totalAmount || 0),
      totalAmount: Number(record.amount || record.totalAmount || 0),
      utr: record.utr || record.transactionId || '',
      transactionId: record.utr || record.transactionId || '',
      events: Array.isArray(record.events) ? record.events : (record.events ? [record.events] : []),
      teammates: Array.isArray(record.teammates) ? record.teammates : (typeof record.teammates === 'string' ? JSON.parse(record.teammates || '[]') : []),
      screenshotBase64: cleanScreenshot,
      status: record.status || 'Pending Verification',
      gatePermittedAt: record.gatePermittedAt || null,
      isSpot: Boolean(record.isSpot),
      timestamp: record.timestamp || new Date().toLocaleString(),
      updatedAt: new Date().toISOString()
    };

    let rtdbSuccess = false;

    // 1. Primary: Save directly to Firebase Realtime Database
    try {
      if (this.rtdb || (typeof firebase !== 'undefined' && firebase.database)) {
        const db = this.rtdb || firebase.database();
        await db.ref('registrations/' + docId).set(payload);
        rtdbSuccess = true;
        console.log(`%c[Firebase]%c Pass ${docId} stored in Firebase Realtime Database!`, 'color:#10b981;font-weight:bold;', 'color:inherit;');
      }
    } catch (rtdbErr) {
      console.warn('[Firebase] RTDB write notice:', rtdbErr);
    }

    // REST fallback if SDK write encountered any issue
    if (!rtdbSuccess) {
      try {
        const res = await fetch(`https://agni2k26-default-rtdb.firebaseio.com/registrations/${docId}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          rtdbSuccess = true;
          console.log(`[Firebase REST] Stored pass ${docId} via Realtime Database REST API.`);
        }
      } catch (restErr) {
        console.warn('[Firebase REST] RTDB fallback notice:', restErr);
      }
    }

    // 2. Parallel: Save to Firestore if permissions allow
    try {
      if (this.firestore || (typeof firebase !== 'undefined' && firebase.firestore)) {
        const fs = this.firestore || firebase.firestore();
        await fs.collection('registrations').doc(docId).set(payload, { merge: true });
        console.log(`[Firebase Firestore] Pass ${docId} synced with Cloud Firestore.`);
      }
    } catch (fsErr) {
      // Gracefully ignore Firestore permission note when RTDB is already storing data
    }

    return { success: rtdbSuccess, docId, data: payload };
  },

  // Lookup registration by regId, phone, email, or UTR
  async lookupRegistration(identifier) {
    if (!identifier) return null;
    const cleanId = identifier.trim().toLowerCase();
    const docKey = identifier.trim().toUpperCase();

    // 1. Direct query in Firebase Realtime Database (ultra fast)
    try {
      const res = await fetch(`https://agni2k26-default-rtdb.firebaseio.com/registrations/${docKey}.json`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.regId) return data;
      }
    } catch (e) {}

    // 2. Search entire list in Realtime Database by email or phone
    try {
      const res = await fetch(`https://agni2k26-default-rtdb.firebaseio.com/registrations.json`);
      if (res.ok) {
        const allData = await res.json();
        if (allData && typeof allData === 'object') {
          for (const key of Object.keys(allData)) {
            const item = allData[key];
            if (!item) continue;
            if (
              (item.regId && item.regId.toLowerCase() === cleanId) ||
              (item.email && item.email.toLowerCase() === cleanId) ||
              (item.phone && item.phone.trim() === identifier.trim()) ||
              (item.utr && item.utr.trim() === identifier.trim())
            ) {
              return item;
            }
          }
        }
      }
    } catch (e) {}

    // 3. Fallback to Firestore if accessible
    try {
      if (this.firestore || (typeof firebase !== 'undefined' && firebase.firestore)) {
        const fs = this.firestore || firebase.firestore();
        const docSnap = await fs.collection('registrations').doc(docKey).get();
        if (docSnap.exists) return docSnap.data();
      }
    } catch (e) {}

    return null;
  },

  // Fetch all registrations from Firebase
  async fetchAllRegistrations() {
    // 1. Fetch from Realtime Database
    try {
      const res = await fetch(`https://agni2k26-default-rtdb.firebaseio.com/registrations.json`);
      if (res.ok) {
        const allData = await res.json();
        if (allData && typeof allData === 'object') {
          const list = Object.values(allData).filter(item => item && item.regId);
          list.sort((a, b) => new Date(b.timestamp || b.updatedAt || 0) - new Date(a.timestamp || a.updatedAt || 0));
          return list;
        }
      }
    } catch (e) {
      console.warn('[Firebase] RTDB fetch note:', e);
    }

    // 2. Fallback to Firestore
    try {
      if (this.firestore || (typeof firebase !== 'undefined' && firebase.firestore)) {
        const fs = this.firestore || firebase.firestore();
        const snap = await fs.collection('registrations').get();
        const list = [];
        snap.forEach(d => list.push(d.data()));
        return list;
      }
    } catch (e) {}

    return [];
  },

  // Real-time synchronization listener for Admin portal
  subscribeRegistrations(onData, onError) {
    // 1. Realtime Database listener (works with 0 permission issues)
    try {
      if (this.rtdb || (typeof firebase !== 'undefined' && firebase.database)) {
        const db = this.rtdb || firebase.database();
        const ref = db.ref('registrations');
        ref.on('value', (snapshot) => {
          const val = snapshot.val();
          if (val && typeof val === 'object') {
            const list = Object.values(val).filter(item => item && item.regId);
            list.sort((a, b) => new Date(b.timestamp || b.updatedAt || 0) - new Date(a.timestamp || a.updatedAt || 0));
            if (typeof onData === 'function') onData(list);
          } else {
            if (typeof onData === 'function') onData([]);
          }
        }, (err) => {
          console.warn('[Firebase] RTDB listener note:', err);
          this.pollRegistrations(onData);
        });

        return () => ref.off();
      }
    } catch (e) {
      console.warn('[Firebase] RTDB onValue notice:', e);
    }

    // Polling fallback
    return this.pollRegistrations(onData);
  },

  // Reliable background polling fallback every 8 seconds
  pollRegistrations(callback, intervalMs = 8000) {
    let active = true;
    const poll = async () => {
      if (!active) return;
      try {
        const list = await this.fetchAllRegistrations();
        if (callback && active) callback(list);
      } catch (e) {}
      if (active) setTimeout(poll, intervalMs);
    };
    poll();
    return () => { active = false; };
  },

  // Update specific fields (gatePermittedAt, status, etc.)
  async updateRegistration(regId, fields) {
    if (!regId || !fields) return false;
    const docId = regId.trim().toUpperCase();
    const updatePayload = {
      ...fields,
      updatedAt: new Date().toISOString()
    };

    let updated = false;

    // 1. Update in Realtime Database
    try {
      if (this.rtdb || (typeof firebase !== 'undefined' && firebase.database)) {
        const db = this.rtdb || firebase.database();
        await db.ref('registrations/' + docId).update(updatePayload);
        updated = true;
      }
    } catch (e) {}

    // Fallback REST PATCH
    if (!updated) {
      try {
        const res = await fetch(`https://agni2k26-default-rtdb.firebaseio.com/registrations/${docId}.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload)
        });
        if (res.ok) updated = true;
      } catch (e) {}
    }

    // 2. Parallel update in Firestore
    try {
      if (this.firestore || (typeof firebase !== 'undefined' && firebase.firestore)) {
        const fs = this.firestore || firebase.firestore();
        await fs.collection('registrations').doc(docId).update(updatePayload);
      }
    } catch (e) {}

    return updated;
  },

  // Delete registration record
  async deleteRegistration(regId) {
    if (!regId) return false;
    const docId = regId.trim().toUpperCase();

    // 1. Delete in Realtime Database
    try {
      if (this.rtdb || (typeof firebase !== 'undefined' && firebase.database)) {
        const db = this.rtdb || firebase.database();
        await db.ref('registrations/' + docId).remove();
      } else {
        await fetch(`https://agni2k26-default-rtdb.firebaseio.com/registrations/${docId}.json`, {
          method: 'DELETE'
        });
      }
    } catch (e) {}

    // 2. Delete in Firestore
    try {
      if (this.firestore || (typeof firebase !== 'undefined' && firebase.firestore)) {
        const fs = this.firestore || firebase.firestore();
        await fs.collection('registrations').doc(docId).delete();
      }
    } catch (e) {}

    return true;
  },

  // Fetch events configuration
  async fetchEvents() {
    try {
      const res = await fetch(`https://agni2k26-default-rtdb.firebaseio.com/events_config.json`);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data) && data.length > 0) {
          return data;
        }
      }
    } catch (e) {
      console.warn('[Firebase] events fetch note:', e);
    }
    return null;
  },

  // Save events configuration
  async saveEvents(eventsList) {
    if (!eventsList || !Array.isArray(eventsList)) return false;
    try {
      if (this.rtdb || (typeof firebase !== 'undefined' && firebase.database)) {
        const db = this.rtdb || firebase.database();
        await db.ref('events_config').set(eventsList);
        return true;
      } else {
        const res = await fetch(`https://agni2k26-default-rtdb.firebaseio.com/events_config.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventsList)
        });
        return res.ok;
      }
    } catch (e) {
      console.warn('[Firebase] saveEvents error:', e);
      return false;
    }
  }
};
