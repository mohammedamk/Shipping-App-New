<template>
  <div class="q-pa-md scroll">
    <q-pull-to-refresh @refresh="refreshContent" ref="refresh">
      <div class="text-h6 q-mb-md">Packages awaiting pickup</div>
      <q-list>
        <q-slide-item
          v-for="(item, index) in packages"
          :key="index"
          left-color="green"
          @left="(opt) => readyToPickup(opt, item.id, item.shipmentUID)"
        >
          <template v-slot:left> <q-icon name="done" /> </template>
          <q-item>
            <q-item-section>
                <q-item-label>
                Shipment ID: <b>{{ item.shipmentUID }}</b></q-item-label
              >
              <q-item-label caption>
                Tracking Number: <b>{{ item.trackingNumber }}</b></q-item-label
              >
              <q-item-label caption lines="4">
                <span class="ma-1"
                  >Client: <b>{{ item.name }}</b>
                </span>
                <br />
                createdAt: <b>{{ item.createdAt }}</b> <br />
                <br />
                <b style="color: green">Slide to right to confirm the pickup</b>
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-slide-item>
      </q-list>
    </q-pull-to-refresh>
    <q-dialog v-model="toPickup" persistent>
      <q-card>
        <q-card-section>
          <div class="text-h5">
            Picked up {{ pickupPackage.shipmentUID }}
          </div>
        </q-card-section>
        <q-card-section>
          <div class="text-h7">
            Are you sure you want to confirm the pickup of this package?
          </div>
        </q-card-section>
        <q-card-action>
          <q-btn flat color="green" label="Pickup" @click="pickupPackageConfirmation" v-close-popup />
          <q-btn flat label="Cancel" v-close-popup />
        </q-card-action>
      </q-card>
    </q-dialog>
  </div>
</template>

<script>
import { defineComponent, ref } from "vue";
import {
  getPickupPackages,
  markAsPickup,
} from "src/services/logisticService";
import { useQuasar } from "quasar";
import { useStore } from "vuex";
import { useRouter } from "vue-router";

export default defineComponent({
  setup() {
    const packages = ref([]);
    const refresh = ref(null);
    const quasar = useQuasar();
    const $store = useStore();
    const router = useRouter();
    const toPickup = ref(false);
    const pickupPackage = ref({});

    getPickupPackages(
      $store.state.auth.jwt,
      $store.state.auth.warehouse
    ).then((result) => {
      if (result.status === "success") {
        packages.value = result.message;
      } else {
        if (result.unauthorized) {
          router.push({ name: "Login" });
        }
        quasar.notify({
          type: "negative",
          message: result.message,
        });
      }
    });

    return {
      packages,
      refresh,
      toPickup,
      pickupPackage,
      refreshContent(done) {
        getPickupPackages(
          $store.state.auth.jwt,
          $store.state.auth.warehouse
        ).then((result) => {
          if (result.status === "success") {
            packages.value = result.message;
          } else {
            quasar.notify({
              type: "negative",
              message: result.message,
            });
          }
          done();
        });
      },
      readyToPickup({ reset }, id, shipmentUID) {
        pickupPackage.value = { id, shipmentUID };
        toPickup.value = true;
        reset();
      },
      pickupPackageConfirmation() {
        let data = new FormData();
        data.set("id", pickupPackage.value.id);
        markAsPickup($store.state.auth.jwt, data).then((result) => {
          if (result.status === "success") {
            refresh.value.trigger();
            quasar.notify({
              type: "positive",
              message: result.message,
            });
          } else {
            quasar.notify({
              type: "negative",
              message: result.message,
            });
          }
          toReturn.value = false;
          pickupPackage.value = {};
        });
      },
    };
  },
});
</script>
