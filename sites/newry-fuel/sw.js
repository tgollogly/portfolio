/* Newry Fuel Watch — push alerts + tap-to-call Safe Fuels */
self.addEventListener("push", function (event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "Newry Fuel Watch", body: event.data && event.data.text() };
  }
  var title = data.title || "‼️ Fuel buy alert";
  var options = {
    body: data.body || "Good time to buy near Newry",
    icon: data.icon || "/newry-fuel/icons/icon-192.png",
    badge: data.badge || "/newry-fuel/icons/icon-192.png",
    tag: data.tag || "newry-fuel-buy",
    renotify: true,
    data: data.data || { tel: "+442830830691", url: "/newry-fuel/?call=1" },
    actions: [{ action: "call", title: "Call Safe Fuels" }],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var tel = (event.notification.data && event.notification.data.tel) || "+442830830691";
  var url = (event.notification.data && event.notification.data.url) || "/newry-fuel/?call=1";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      if (event.action === "call" || true) {
        try {
          clients.openWindow("tel:" + tel.replace(/\s/g, ""));
        } catch (e) { /* ignore */ }
      }
      var target = list.find(function (c) {
        return c.url && c.url.indexOf("/newry-fuel") >= 0;
      });
      if (target) return target.focus();
      return clients.openWindow(url);
    })
  );
});

self.addEventListener("install", function (event) {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", function (event) {
  event.waitUntil(clients.claim());
});
