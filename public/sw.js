// Service Worker LaCentral — push + installabilité PWA.
// Ne pas intercepter les POST (Server Actions / /api/orders) : ça casse le checkout mobile.
// cache-bust: 2026-08-30-parcel-actions

self.addEventListener("install", (event) => {
  self.skipWaiting()
})

// Ne jamais intercepter POST / Server Actions : le checkout mobile casse sinon.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { title: "LaCentral", body: event.data ? event.data.text() : "" }
  }

  const title = data.title || "LaCentral"
  const options = {
    body: data.body || "",
    icon: "/images/logoapp.png",
    badge: "/images/logoapp.png",
    tag: data.tag || undefined,
    data: { url: data.url || "/" },
    vibrate: [80, 40, 80],
    // Propriété "image" : grande image affichée dans le corps de la notification
    // (Android Chrome, Edge). Ignorée silencieusement sur les plateformes qui ne la supportent pas.
    ...(data.image ? { image: data.image } : {}),
  }

  // Ping le serveur pour marquer la notification comme reçue/lue par ce client.
  // notificationId et customerToken sont injectés dans le payload côté serveur.
  const readPing = (data.notificationId && data.customerToken)
    ? fetch("/api/notification-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationId: data.notificationId,
          customerToken: data.customerToken,
        }),
      }).catch(() => {})
    : Promise.resolve()

  // Badge icône app (PWA) : compte fourni ou nombre de notifs système en attente
  const badgeUpdate = (async () => {
    try {
      if (typeof self.registration.setAppBadge !== "function") return
      if (typeof data.badgeCount === "number" && data.badgeCount >= 0) {
        if (data.badgeCount === 0) await self.registration.clearAppBadge?.()
        else await self.registration.setAppBadge(data.badgeCount)
        return
      }
      const existing = await self.registration.getNotifications()
      // +1 pour la notif qui va s'afficher
      const n = existing.length + 1
      await self.registration.setAppBadge(n)
    } catch (e) {
      /* ignore */
    }
  })()

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      readPing,
      badgeUpdate,
    ])
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || "/"

  event.waitUntil(
    Promise.all([
      // Recalcule le badge après fermeture de cette notif
      (async () => {
        try {
          if (typeof self.registration.setAppBadge !== "function") return
          const left = await self.registration.getNotifications()
          const n = Math.max(0, left.length - 1) // celle cliquée va se fermer
          if (n <= 0) await self.registration.clearAppBadge?.()
          else await self.registration.setAppBadge(n)
        } catch (e) {}
      })(),
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
        // Si un onglet de l'app est déjà ouvert, on le focus et on navigue.
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus()
            if ("navigate" in client) {
              try {
                client.navigate(targetUrl)
              } catch (e) {}
            }
            // Demande à la page de resync les compteurs
            try {
              client.postMessage({ type: "LACENTRAL_REFRESH_BADGES" })
            } catch (e) {}
            return
          }
        }
        // Sinon on ouvre une nouvelle fenêtre.
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl)
        }
      }),
    ]),
  )
})
