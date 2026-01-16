const CACHE_VERSION = 'v25';
const CACHE_NAME = `biveto-${CACHE_VERSION}`;
const STATIC_CACHE = `biveto-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `biveto-dynamic-${CACHE_VERSION}`;

// Assets to cache immediately (NOT index.html - always fetch fresh)
const STATIC_ASSETS = [
  '/manifest.json',
  '/logo.svg',
  '/favicon.svg',
  '/logo-icon.svg',
  '/icons/icon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install event - cache static assets (with error handling for each file)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(async cache => {
        console.log('Caching static assets');
        // Cache files individually to avoid failing entire install
        for (const asset of STATIC_ASSETS) {
          try {
            await cache.add(asset);
          } catch (err) {
            console.warn(`Failed to cache ${asset}:`, err.message);
          }
        }
      })
      .then(() => self.skipWaiting())
      .catch(err => {
        console.warn('Service worker install error:', err);
        // Still skip waiting even if caching fails
        return self.skipWaiting();
      })
  );
});

// Activate event - clean ALL old caches and force refresh
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      console.log('Cleaning old caches, current version:', CACHE_VERSION);
      return Promise.all(
        keys
          .filter(key => !key.includes(CACHE_VERSION))
          .map(key => {
            console.log('Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    })
    .then(() => self.clients.claim())
    .then(() => {
      // Notify all clients to refresh
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'CACHE_UPDATED', version: CACHE_VERSION });
        });
      });
    })
  );
});

// Fetch event - handle share target, API calls, and caching
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle Share Target POST requests
  if (request.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith(handleShareTarget(request));
    return;
  }

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s) schemes
  if (!url.protocol.startsWith('http')) return;

  // API requests - network first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // HTML/Navigation requests - ALWAYS network first to get fresh content
  if (request.mode === 'navigate' || request.destination === 'document' || url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache the fresh response for offline use
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Only use cache as fallback when offline
          return caches.match(request) || caches.match('/');
        })
    );
    return;
  }

  // JS/CSS with hash in filename - cache forever (immutable)
  if (url.pathname.startsWith('/assets/') && /\.[a-f0-9]{8,}\./.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        if (cachedResponse) return cachedResponse;
        return fetch(request).then(response => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE).then(cache => cache.put(request, responseClone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Other static assets - cache first with network fallback
  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        if (cachedResponse) return cachedResponse;
        return fetch(request).then(response => {
          if (!response || response.status !== 200) return response;
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, responseClone));
          return response;
        });
      })
      .catch(() => null)
  );
});

// Handle Share Target POST requests
async function handleShareTarget(request) {
  try {
    const formData = await request.formData();
    const title = formData.get('title') || '';
    const text = formData.get('text') || '';
    const url = formData.get('url') || '';
    const files = formData.getAll('files');

    // Prepare share data
    const shareData = {
      title,
      text,
      url,
      files: []
    };

    // Convert files to base64 for storage
    if (files && files.length > 0) {
      for (const file of files) {
        if (file instanceof File && file.size > 0) {
          const base64 = await fileToBase64(file);
          shareData.files.push({
            name: file.name,
            type: file.type,
            data: base64
          });
        }
      }
    }

    // Get the client and store the share data
    const allClients = await self.clients.matchAll({ type: 'window' });

    if (allClients.length > 0) {
      // Send data to existing client
      allClients[0].postMessage({
        type: 'SHARE_TARGET',
        data: shareData
      });
    }

    // Redirect to share-target page with query params
    const redirectUrl = new URL('/share-target', self.location.origin);
    if (title) redirectUrl.searchParams.set('title', title);
    if (text) redirectUrl.searchParams.set('text', text);
    if (url) redirectUrl.searchParams.set('url', url);

    // Store file data in a way the page can access
    // We'll use a cache entry for this
    if (shareData.files.length > 0) {
      const cache = await caches.open(DYNAMIC_CACHE);
      await cache.put(
        new Request('/_share-data'),
        new Response(JSON.stringify(shareData), {
          headers: { 'Content-Type': 'application/json' }
        })
      );
    }

    return Response.redirect(redirectUrl.toString(), 303);
  } catch (error) {
    console.error('Error handling share target:', error);
    return Response.redirect('/upload', 303);
  }
}

// Convert File to base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
  });
}

// Background Sync - retry failed API requests when online
self.addEventListener('sync', event => {
  console.log('Background sync event:', event.tag);

  if (event.tag === 'sync-transactions') {
    event.waitUntil(syncTransactions());
  }

  if (event.tag === 'sync-pending-data') {
    event.waitUntil(syncPendingData());
  }
});

// Sync pending transactions
async function syncTransactions() {
  try {
    const cache = await caches.open(DYNAMIC_CACHE);
    const pendingRequests = await cache.match('/_pending-transactions');

    if (!pendingRequests) return;

    const pending = await pendingRequests.json();

    for (const item of pending) {
      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body
        });

        if (response.ok) {
          // Remove from pending
          pending.splice(pending.indexOf(item), 1);
        }
      } catch (err) {
        console.warn('Failed to sync transaction:', err);
      }
    }

    // Update pending list
    if (pending.length > 0) {
      await cache.put(
        new Request('/_pending-transactions'),
        new Response(JSON.stringify(pending))
      );
    } else {
      await cache.delete('/_pending-transactions');
    }

    // Notify clients
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'SYNC_COMPLETE', tag: 'sync-transactions' });
    });
  } catch (error) {
    console.error('Error syncing transactions:', error);
  }
}

// Sync any pending data
async function syncPendingData() {
  try {
    const cache = await caches.open(DYNAMIC_CACHE);
    const pendingData = await cache.match('/_pending-data');

    if (!pendingData) return;

    const pending = await pendingData.json();

    for (const item of pending) {
      try {
        await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: JSON.stringify(item.data)
        });
      } catch (err) {
        console.warn('Failed to sync data:', err);
      }
    }

    await cache.delete('/_pending-data');

    // Notify clients
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'SYNC_COMPLETE', tag: 'sync-pending-data' });
    });
  } catch (error) {
    console.error('Error syncing pending data:', error);
  }
}

// Periodic Background Sync - fetch fresh data periodically
self.addEventListener('periodicsync', event => {
  console.log('Periodic sync event:', event.tag);

  if (event.tag === 'refresh-dashboard') {
    event.waitUntil(refreshDashboardData());
  }

  if (event.tag === 'check-invoices') {
    event.waitUntil(checkUpcomingInvoices());
  }
});

// Refresh dashboard data in background
async function refreshDashboardData() {
  try {
    // Fetch fresh dashboard data
    const response = await fetch('/api/dashboard/summary');
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      await cache.put('/api/dashboard/summary', response.clone());
      console.log('Dashboard data refreshed in background');
    }
  } catch (error) {
    console.warn('Failed to refresh dashboard data:', error);
  }
}

// Check for upcoming invoices and notify
async function checkUpcomingInvoices() {
  try {
    const response = await fetch('/api/invoices/upcoming');
    if (!response.ok) return;

    const invoices = await response.json();
    const today = new Date();
    const threeDaysFromNow = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);

    for (const invoice of invoices) {
      const dueDate = new Date(invoice.due_date);
      if (dueDate <= threeDaysFromNow && dueDate >= today) {
        await self.registration.showNotification('Fatura próxima do vencimento', {
          body: `${invoice.credit_card_name}: R$ ${invoice.amount.toFixed(2)} vence em ${dueDate.toLocaleDateString('pt-BR')}`,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
          tag: `invoice-${invoice.id}`,
          data: { url: '/invoices' }
        });
      }
    }
  } catch (error) {
    console.warn('Failed to check invoices:', error);
  }
}

// Handle push notifications
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  const title = data.title || 'Biveto';
  const options = {
    body: data.body || 'Nova notificação',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});

// Handle messages from clients
self.addEventListener('message', event => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'QUEUE_SYNC') {
    // Queue data for background sync
    event.waitUntil(queueForSync(event.data.payload));
  }
});

// Queue data for background sync
async function queueForSync(payload) {
  try {
    const cache = await caches.open(DYNAMIC_CACHE);
    const existing = await cache.match('/_pending-data');
    const pending = existing ? await existing.json() : [];

    pending.push(payload);

    await cache.put(
      new Request('/_pending-data'),
      new Response(JSON.stringify(pending))
    );

    // Register for sync
    await self.registration.sync.register('sync-pending-data');
  } catch (error) {
    console.error('Error queuing for sync:', error);
  }
}
