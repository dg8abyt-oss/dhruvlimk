importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAccxtHdhMmMaYLesbRRGrXgzgM8I74uYU",
  projectId: "appex-ca05f",
  messagingSenderId: "251243500031",
  appId: "1:251243500031:web:a031fe6c3f580e641117ca"
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage(async (payload) => {
  let title = payload.notification.title;
  let body = payload.notification.body;
  let icon = payload.notification.image || "/default-icon.png";
  try {
    const res = await fetch('/gateway-config.js');
    const text = await res.text();
    const sMatch = text.match(/senderName:\s*["'](.+?)["']/);
    const iMatch = text.match(/icon:\s*["'](.+?)["']/);
    if (sMatch) title = `${sMatch[1]}: ${title}`;
    if (iMatch && !payload.notification.image) icon = iMatch[1];
  } catch (e) {}
  return self.registration.showNotification(title, { body, icon });
});