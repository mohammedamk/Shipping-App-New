const routes = [
  {
    path: "/",
    component: () => import("layouts/MainLayout.vue"),
    children: [
      { path: "", redirect: "/login" },
      {
        path: "/newPackage",
        name: "NewPackage",
        component: () => import("pages/NewPackage.vue")
      },
      {
        path: "/confirmationPackage",
        name: "ConfirmationPackages",
        component: () => import("pages/ConfirmationPackages.vue"),
      },
      {
        path: "/readyToShipPackage",
        name: "ReadyToShipPackages",
        component: () => import("pages/ReadyToShipPackages.vue"),
      },
      {
        path: "/pickupPackages",
        name: "PickupPackages",
        component: () => import("pages/PickupPackages.vue"),
      },
      {
        path: "/deliveryPackages",
        name: "DeliveryPackages",
        component: () => import("pages/DeliveryPackages.vue"),
      },
      {
        path: "/returningPackage",
        name: "ReturningPackages",
        component: () => import("pages/ReturningPackages.vue"),
      },
    ],
  },
  {
    path: "/login",
    name: "Login",
    component: () => import("pages/Login.vue"),
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: "/:catchAll(.*)*",
    component: () => import("pages/Error404.vue"),
  },
];

export default routes;
