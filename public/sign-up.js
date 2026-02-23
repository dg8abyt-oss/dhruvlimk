// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Request permission and get token
async function requestNotificationPermission() {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Notification permission granted.');
      const token = await messaging.getToken();
      console.log('Token:', token);

      // Subscribe token to topic
      const response = await fetch('https://firebase-gateway.dhruvs.host/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': window.location.origin
        },
        body: JSON.stringify({ token })
      });

      if (response.ok) {
        document.getElementById('dhruvs-notify-status').style.display = 'block';
        document.getElementById('dhruvs-notify-status').textContent = 'Successfully subscribed to notifications!';
      } else {
        console.error('Failed to subscribe token:', await response.text());
        document.getElementById('dhruvs-notify-status').style.display = 'block';
        document.getElementById('dhruvs-notify-status').textContent = 'Failed to subscribe to notifications.';
      }
    } else {
      console.log('Unable to get permission to notify.');
      document.getElementById('dhruvs-notify-status').style.display = 'block';
      document.getElementById('dhruvs-notify-status').textContent = 'Notification permission denied.';
    }
  } catch (err) {
    console.error('Error getting notification permission:', err);
    document.getElementById('dhruvs-notify-status').style.display = 'block';
    document.getElementById('dhruvs-notify-status').textContent = 'Error requesting notification permission.';
  }
}

// Set up button click handler
document.getElementById('dhruvs-notify-btn').addEventListener('click', requestNotificationPermission);

// Handle incoming messages
messaging.onMessage((payload) => {
  console.log('Message received. ', payload);
  // Customize notification here
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: payload.notification.icon || '/icons/icon-192x192.png'
  };

  new Notification(notificationTitle, notificationOptions);
});