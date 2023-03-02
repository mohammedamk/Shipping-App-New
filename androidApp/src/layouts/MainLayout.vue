<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated>
      <q-toolbar>
        <q-toolbar-title> Kaizen Shipping Logistics App </q-toolbar-title>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>

    <q-footer elevated>
      <q-tabs
        outside-arrows
        mobile-arrows
        v-model="bottomTab"
        class="text-teal"
      >
        <q-tab
          style="color: black"
          name="NewPackage"
          icon="local_shipping"
          label="New Package"
        />
        <q-tab
          style="color: black"
          name="ConfirmationPackages"
          icon="mail"
          label="Confirmation"
        />
        <q-tab
          style="color: black"
          name="ReadyToShipPackages"
          icon="alarm"
          label="Shipping"
        />
        <q-tab
          style="color: black"
          name="PickupPackages"
          icon="inventory_2"
          label="Pickup Packages"
        />


        <q-tab
          style="color: black"
          name="DeliveryPackages"
          icon="delivery_dining"
          label="Delivery Packages"
        />



        <q-tab
          style="color: black"
          name="ReturningPackages"
          icon="movie"
          label="Returning"
        />
      </q-tabs>
    </q-footer>
  </q-layout>
</template>

<script>
import { defineComponent, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

export default defineComponent({
  name: "MainLayout",

  setup() {
    const route = useRoute();
    const router = useRouter();
    const bottomTab = ref(route.name);

    watch(bottomTab, (v) => {
      router.push({
        name: v,
      });
    });

    return {
      bottomTab,
    };
  },
});
</script>
