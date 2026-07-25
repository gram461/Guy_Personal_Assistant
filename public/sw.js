importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyBzBQbpZ0hTJhVCZg84YO0qPU9MFqZCYyo',
  authDomain: 'guy-personal-assistant-fbf12.firebaseapp.com',
  projectId: 'guy-personal-assistant-fbf12',
  storageBucket: 'guy-personal-assistant-fbf12.firebasestorage.app',
  messagingSenderId: '597265356676',
  appId: '1:597265356676:web:d10edfe47f8a87193aefd1',
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {}
  self.registration.showNotification(title || 'Guy\'s Personal Assistant', {
    body: body || '',
    icon: '/icon-192.png',
  })
})

self.addEventListener('fetch', () => {})
