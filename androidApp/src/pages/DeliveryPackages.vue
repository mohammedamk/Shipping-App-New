<template>
  <div class="q-pa-md scroll">
    <q-pull-to-refresh @refresh="refreshContent" ref="refresh">
      <div class="text-h6 q-mb-md">Packages awaiting delivery/out for delivery</div>
      <q-list>
        <q-slide-item
          v-for="(item, index) in packages"
          :key="index"
          left-color="green"
          @left="(opt) => readyToDeliveryOrOutForDelivery(opt, item.id, item.shipmentUID, item.status)"
        >
          <template v-slot:left> <q-icon name="done" /> </template>
          <q-item>
            <q-item-section>
              <q-item-label>Shipment ID: <b>{{ item.shipmentUID }}</b></q-item-label>
              <q-item-label caption>
                Tracking Number: <b>{{ item.trackingNumber }}</b>
              </q-item-label>
              <q-item-label caption lines="4">
                <span class="ma-1">
                  Client: <b>{{ item.name }}</b>
                </span>
                <br />
                createdAt: <b>{{ item.createdAt }}</b> <br />
                <br />
                <b style="color: green" v-if="item.status == 'Ready to ship'">Slide to right to confirm Out for delivery</b>
                <b style="color: green" v-else>Slide to right to confirm delivery</b>
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-slide-item>
      </q-list>
    </q-pull-to-refresh>
    <q-dialog v-model="toDeliver" persistent>
      <q-card>
        <q-card-section>
          <div class="text-h5" v-if="pickupPackage.status == 'Ready to ship'">Out for delivery {{ pickupPackage.shipmentUID }}</div>
          <div class="text-h5" v-else>Shipped {{ pickupPackage.shipmentUID }}</div>
        </q-card-section>
        <q-card-section>
          <div class="text-h7" v-if="pickupPackage.status == 'Ready to ship'">Are you sure you want to confirm out for delivery of this package?</div>
          <div class="text-h7" v-else>Are you sure you want to confirm the delivery of this package?</div>
        </q-card-section>
        <q-card-action>
          <q-btn flat color="green" label="Out for Delivery" @click="pickupPackageConfirmation" v-close-popup v-if="pickupPackage.status == 'Ready to ship'" />
          <q-btn flat color="green" label="Shipped" @click="pickupPackageConfirmation" v-close-popup v-else />
          <q-btn flat label="Cancel" v-close-popup />
        </q-card-action>
      </q-card>
    </q-dialog>
  </div>
</template>

<script>
import { defineComponent, ref } from "vue";
import {
  getDeliveryPackages,
  markAsOutForDeliveryOrShipped,
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
    const toDeliver = ref(false);
    const pickupPackage = ref({});

    getDeliveryPackages(
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
      toDeliver,
      pickupPackage,
      refreshContent(done) {
        getDeliveryPackages(
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
      readyToDeliveryOrOutForDelivery({ reset }, id, shipmentUID, status) {
        pickupPackage.value = { id, shipmentUID, status };
        toDeliver.value = true;
        reset();
      },
      pickupPackageConfirmation() {
        let data = new FormData();
        data.set("order_id", pickupPackage.value.id);
        if ( pickupPackage.value.status == 'Ready to ship' ) {
          data.set("job_type", 0);
          data.set("job_status", 1);
        } else if ( pickupPackage.value.status == 'Out for delivery' ) {
          data.set("job_type", 1);
          data.set("job_status", 2);
        }
        markAsOutForDeliveryOrShipped($store.state.auth.jwt, data).then((result) => {
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
          // toReturn.value = false;
          pickupPackage.value = {};
        });
      },
    };
  },
});
</script>
