const CACHE = "qve-shell-v3";
const SHELL = ["./manifest.json"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  // لا يتم تخزين طلبات قاعدة البيانات مؤقتًا — يجب أن تصل دائمًا مباشرة
  if (url.hostname.includes("supabase.co")) return;

  // صفحة index.html: شبكة أولًا دائمًا حتى تصل كل التحديثات فورًا، ونخزّنها فقط كنسخة احتياطية للعمل دون اتصال
  const isAppShellPage = e.request.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("index.html");
  if (isAppShellPage) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // باقي الملفات (الأيقونات، الإعدادات...): من التخزين المؤقت أولًا لسرعة التحميل
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

/* ===================== إشعارات بلاغ الهروب (Web Push) ===================== */
self.addEventListener("push", e => {
  let payload = {};
  try { payload = e.data ? e.data.json() : {}; } catch (err) { payload = {}; }
  const title = payload.title || "🚨 بلاغ هروب من الحصة";
  const options = {
    body: payload.body || "",
    icon: "./icon-192.png",
    badge: "./icon-192.png",
    tag: payload.tag || "escape-alert",
    dir: "rtl",
    lang: "ar",
    requireInteraction: true,
    vibrate: [300, 150, 300, 150, 300],
    data: payload.data || {}
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const c of list) { if ("focus" in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow("./");
    })
  );
});
