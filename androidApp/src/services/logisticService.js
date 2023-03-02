import { api } from "src/boot/axios";

export async function login(data) {
  return api
    .post("/logistics/login", data)
    .then((response) => response.data)
    .catch((err) => {
      console.log(err);
      return { status: "failed", message: err.message };
    });
}
export async function getWarehouses() {
  return api
    .get("/logistics/warehouses")
    .then((response) => response.data)
    .catch((err) => {
      console.log(err);
      return { status: "failed", message: err.message };
    });
}
export async function getToShipPackages(jwt, warehouse) {
  return api
    .get("/logistics/toShipPackages", {
      params: { warehouse },
      headers: { Authorization: `Bearer ${jwt}` },
    })
    .then((response) => response.data)
    .catch((err) => {
      console.log(err);
      return { status: "failed", message: err.message };
    });
}
export async function getConfirmationPackages(jwt, warehouse) {
  return api
    .get("/logistics/confirmationPackages", {
      params: { warehouse },
      headers: { Authorization: `Bearer ${jwt}` },
    })
    .then((response) => response.data)
    .catch((err) => {
      console.log(err);
      return { status: "failed", message: err.message };
    });
}
export async function getReturningPackages(jwt, warehouse) {
  return api
    .get("/logistics/returningPackages", {
      params: { warehouse },
      headers: { Authorization: `Bearer ${jwt}` },
    })
    .then((response) => response.data)
    .catch((err) => {
      console.log(err);
      return { status: "failed", message: err.message };
    });
}

export async function getPickupPackages(jwt, warehouse) {
  return api
    .get("/logistics/readyToPickupPackages", {
      params: { warehouse },
      headers: { Authorization: `Bearer ${jwt}` },
    })
    .then((response) => response.data)
    .catch((err) => {
      console.log(err);
      return { status: "failed", message: err.message };
    });
}

export async function getDeliveryPackages(jwt, warehouse) {
  return api
    .get("/logistics/readyToDeliverPackages", {
      params: { warehouse },
      headers: { Authorization: `Bearer ${jwt}` },
    })
    .then((response) => response.data)
    .catch((err) => {
      console.log(err);
      return { status: "failed", message: err.message };
    });
}

export async function askDeclaredValue(jwt, data) {
  return api
    .post("/logistics/askDeclaredValue", data, {
      headers: { Authorization: `Bearer ${jwt}` },
    })
    .then((response) => response.data)
    .catch((err) => {
      console.log(err);
      return { status: "failed", message: err.message };
    });
}
export async function markAsReadyToShipped(jwt, warehouse, data) {
  return api
    .post("/logistics/markAsReadyToShipped", data, {
      headers: { Authorization: `Bearer ${jwt}` },
    })
    .then((response) => response.data)
    .catch((err) => {
      console.log(err);
      return { status: "failed", message: err.message };
    });
}
export async function markAsReturned(jwt, data) {
  return api
    .post("/logistics/markAsReturned", data, {
      headers: { Authorization: `Bearer ${jwt}` },
    })
    .then((response) => response.data)
    .catch((err) => {
      console.log(err);
      return { status: "failed", message: err.message };
    });
}



export async function markAsPickup(jwt, data) {
  return api
    .post("/logistics/markAsPickup", data, {
      headers: { Authorization: `Bearer ${jwt}` },
    })
    .then((response) => response.data)
    .catch((err) => {
      console.log(err);
      return { status: "failed", message: err.message };
    });
}


export async function markAsOutForDeliveryOrShipped(jwt, data) {
  return api
    .post("/logistics/packageStatusChange", data, {
      headers: { Authorization: `Bearer ${jwt}` },
    })
    .then((response) => response.data)
    .catch((err) => {
      console.log(err);
      return { status: "failed", message: err.message };
    });
}



export async function getServices(jwt, warehouse) {
  return api
    .get("/logistics/services", {
      params: { warehouse },
      headers: { Authorization: `Bearer ${jwt}` },
    })
    .then((response) => response.data)
    .catch((err) => {
      console.log(err);
      return { status: "failed", message: err.message };
    });
}
export async function markAsPreparedToReturn(jwt, data) {
  return api
    .post("/logistics/markAsPreparedToReturn", data, {
      headers: { Authorization: `Bearer ${jwt}` },
    })
    .then((response) => response.data)
    .catch((err) => {
      console.log(err);
      return { status: "failed", message: err.message };
    });
}
export async function getCustomers(jwt) {
  return api
    .get("/logistics/customers", {
      headers: { Authorization: `Bearer ${jwt}` },
    })
    .then((response) => response.data)
    .catch((err) => {
      console.log(err);
      return { status: "failed", message: err.message };
    });
}
export async function createPackage(jwt, data) {
  return api
    .post("/logistics/createPackage", data, {
      headers: { Authorization: `Bearer ${jwt}` },
    })
    .then((response) => response.data)
    .catch((err) => {
      console.log(err);
      return { status: "failed", message: err.message };
    });
}
export async function markPackageAsArrived(jwt, data) {
  return api
    .post("/logistics/markAsArrived", data, {
      headers: { Authorization: `Bearer ${jwt}` },
    })
    .then((response) => response.data)
    .catch((err) => {
      console.log(err);
      return { status: "failed", message: err.message };
    });
}
export async function getPackageByTrackingNumber(jwt, trackingNumber) {
  return api
    .get("/logistics/packageByTN", {
      headers: { Authorization: `Bearer ${jwt}` },
      params: { trackingNumber },
    })
    .then((response) => response.data)
    .catch((err) => {
      console.log(err);
      return { status: "failed", message: err.message };
    });
}
