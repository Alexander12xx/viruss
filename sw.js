// ================ ALTECH AI SERVICE WORKER ================
// Version: 2.0.0
// Purpose: Advanced offline functionality, caching, and push notifications

const CACHE_NAME = 'altech-ai-v3.0';
const CACHE_VERSION = '3.0.0';
const API_CACHE_NAME = 'altech-api-cache-v1';
const OFFLINE_URL = '/offline.html';

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
  '/sounds/notification.mp3',
  '/fonts/inter.woff2',
  '/fonts/jakarta.woff2'
];

// API endpoints to cache
const API_ENDPOINTS = [
  '/api/weather',
  '/api/ai',
  '/api/contacts'
];

// ================ INSTALL EVENT ================
self.addEventListener('install', (event) => {
  console.log('🚀 Service Worker: Installing ALTECH AI...');
  
  event.waitUntil(
    Promise.all([
      // Pre-cache essential assets
      caches.open(CACHE_NAME)
        .then((cache) => {
          console.log('📦 Caching app shell...');
          return cache.addAll(PRECACHE_ASSETS);
        }),
      
      // Skip waiting to activate immediately
      self.skipWaiting()
    ])
  );
});

// ================ ACTIVATE EVENT ================
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker: ALTECH AI Activated');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
              console.log('🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Claim clients immediately
      self.clients.claim()
    ])
  );
});

// ================ FETCH EVENT ================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Handle API requests with stale-while-revalidate
  if (API_ENDPOINTS.some(endpoint => url.pathname.startsWith(endpoint))) {
    event.respondWith(handleApiRequest(request));
    return;
  }
  
  // Handle navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone the response to cache it
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(request, responseClone));
          return response;
        })
        .catch(() => {
          // Return offline page if fetch fails
          return caches.match(OFFLINE_URL)
            .then((offlineResponse) => offlineResponse || caches.match('/'));
        })
    );
    return;
  }
  
  // Handle static assets with cache-first strategy
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Update cache in background
          fetchAndCache(request);
          return cachedResponse;
        }
        
        // Fetch from network if not in cache
        return fetch(request)
          .then((response) => {
            // Cache the response if successful
            if (response.status === 200) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME)
                .then((cache) => cache.put(request, responseClone));
            }
            return response;
          })
          .catch(() => {
            // Return generic offline response for assets
            if (request.headers.get('Accept').includes('image')) {
              return new Response(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🤖</text></svg>',
                { headers: { 'Content-Type': 'image/svg+xml' } }
              );
            }
            return new Response('', { status: 408, statusText: 'Offline' });
          });
      })
  );
});

// ================ API REQUEST HANDLER ================
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE_NAME);
  
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // Cache the successful response
    if (networkResponse.ok) {
      const responseClone = networkResponse.clone();
      cache.put(request, responseClone);
    }
    
    return networkResponse;
  } catch (error) {
    // Return cached response if available
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline fallback for API
    return new Response(
      JSON.stringify({ 
        status: 'offline',
        message: 'You are offline. Data shown may be outdated.',
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          'X-ALTECH-Cache': 'offline'
        }
      }
    );
  }
}

// ================ BACKGROUND FETCH AND CACHE ================
async function fetchAndCache(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response);
    }
  } catch (error) {
    // Silently fail for background updates
    console.log('Background update failed:', error.message);
  }
}

// ================ PUSH NOTIFICATION HANDLER ================
self.addEventListener('push', (event) => {
  console.log('📨 Push notification received:', event);
  
  let data = {
    title: 'ALTECH AI',
    body: 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: 'altech-notification',
    data: {
      url: '/',
      timestamp: new Date().toISOString()
    }
  };
  
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (error) {
      console.log('Push data parsing error:', error);
    }
  }
  
  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    data: data.data,
    vibrate: [100, 50, 100],
    actions: [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'close',
        title: 'Close'
      }
    ],
    requireInteraction: true,
    silent: false
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ================ NOTIFICATION CLICK HANDLER ================
self.addEventListener('notificationclick', (event) => {
  console.log('📱 Notification clicked:', event.notification.tag);
  
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  const promiseChain = clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  })
  .then((windowClients) => {
    // Check if there's already a window/tab open with the target URL
    let matchingClient = null;
    
    for (let i = 0; i < windowClients.length; i++) {
      const windowClient = windowClients[i];
      if (windowClient.url.includes(urlToOpen)) {
        matchingClient = windowClient;
        break;
      }
    }
    
    if (matchingClient) {
      // Focus the existing window
      return matchingClient.focus();
    } else {
      // Open a new window
      return clients.openWindow(urlToOpen);
    }
  })
  .then((windowClient) => {
    // Send message to the client
    if (windowClient) {
      windowClient.postMessage({
        type: 'NOTIFICATION_CLICK',
        data: event.notification.data,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  event.waitUntil(promiseChain);
});

// ================ BACKGROUND SYNC ================
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync:', event.tag);
  
  if (event.tag === 'sync-notes') {
    event.waitUntil(syncNotes());
  }
  
  if (event.tag === 'sync-reminders') {
    event.waitUntil(syncReminders());
  }
});

async function syncNotes() {
  try {
    const cache = await caches.open('altech-sync-cache');
    const notes = await cache.match('/api/notes/sync');
    
    if (notes) {
      const response = await fetch('/api/notes/sync', {
        method: 'POST',
        body: await notes.json(),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        await cache.delete('/api/notes/sync');
        self.registration.showNotification('✅ Notes Synced', {
          body: 'Your notes have been synced successfully',
          icon: '/icons/icon-192x192.png'
        });
      }
    }
  } catch (error) {
    console.log('Sync error:', error);
  }
}

async function syncReminders() {
  // Similar implementation for reminders
  console.log('Syncing reminders...');
}

// ================ PERIODIC BACKGROUND SYNC ================
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-weather') {
    event.waitUntil(updateWeatherCache());
  }
  
  if (event.tag === 'update-ai-models') {
    event.waitUntil(updateAIModels());
  }
});

async function updateWeatherCache() {
  try {
    const response = await fetch('/api/weather/locations');
    if (response.ok) {
      const data = await response.json();
      const cache = await caches.open(API_CACHE_NAME);
      await cache.put('/api/weather', new Response(JSON.stringify(data)));
    }
  } catch (error) {
    console.log('Weather update error:', error);
  }
}

async function updateAIModels() {
  console.log('Updating AI models...');
  // Implementation for AI model updates
}

// ================ MESSAGE HANDLER ================
self.addEventListener('message', (event) => {
  console.log('📩 Message received in service worker:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME)
      .then(() => {
        event.ports[0].postMessage({ success: true });
      });
  }
  
  if (event.data && event.data.type === 'GET_CACHE_SIZE') {
    caches.open(CACHE_NAME)
      .then((cache) => cache.keys())
      .then((keys) => {
        event.ports[0].postMessage({ size: keys.length });
      });
  }
});

// ================ ERROR HANDLING ================
self.addEventListener('error', (event) => {
  console.error('Service Worker Error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('Service Worker Unhandled Rejection:', event.reason);
});

console.log('✅ ALTECH AI Service Worker Loaded Successfully');
