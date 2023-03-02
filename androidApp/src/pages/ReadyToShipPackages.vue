<template>
  <div class="q-pa-md scroll">
    <q-pull-to-refresh @refresh="refreshContent" ref="refresh">
      <div class="text-h6 q-mb-md">Packages awaiting shipment</div>
      <q-list>
        <q-slide-item
          v-for="(item, index) in packages"
          :key="index"
          left-color="green"
          @left="(opt) => shipStatusPackage(opt, item.id, item.shipmentUID)"
          @click="deliveryInfoModal(item)"
        >
          <template v-slot:left> <q-icon name="done" /> </template>
          <q-item>
            <q-item-section>
              <q-item-label>
                Shipment ID: <b>{{ item.shipmentUID }}</b>
              </q-item-label>
              <q-item-label
                caption
                v-for="(itm, ind) in item.trackingNumbers"
                :key="ind"
              >
                Tracking Number: #<b>{{ itm }}</b>
              </q-item-label>
              <q-item-label caption>
                <span class="ma-1"
                  >Client: <b>{{ item.name }}</b>
                </span>
                <br />
                createdAt: <b>{{ item.createdAt }}</b> <br />
                <br />
                <b style="color: green"
                  >Slide to right to mark package as Ready To Ship</b
                >
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-slide-item>
      </q-list>
    </q-pull-to-refresh>
    <q-dialog v-model="confirmationModal" persistent>
      <q-card>
        <q-card-section>
          <div class="text-h5">
            Ready to ship {{ selectedPackage.shipmentUID }}
          </div>
        </q-card-section>
        <q-card-section>
          <div class="text-h7">
            Are you sure you want to send this shipment to the delivery API?
          </div>
        </q-card-section>
        <q-card-action>
          <q-btn
            flat
            color="green"
            label="Confirm"
            @click="markAsReadyToShip"
          />
          <q-btn flat label="Cancel" v-close-popup />
        </q-card-action>
      </q-card>
    </q-dialog>

    <q-dialog v-model="deliveryModal">
      <q-card>
        <q-card-section>
          <div class="text-h5">
            Shipment Details For {{ deliveryModalItem.shipmentUID }}
          </div>
        </q-card-section>
        <q-card-section>
          <q-item>
            <q-item-section
              v-for="(item, index) in deliveryModalItem.trackingNumbers"
              :key="index"
            >
              <q-item-label>
                Tracking Number: <b>#{{ item }}</b>
              </q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label>
                Delivery Mode:
                <b>{{ deliveryModalItem.deliveryMode }}</b></q-item-label
              >
            </q-item-section>
          </q-item>
          <q-item v-if="deliveryModalItem.deliveryMode == 'Pickup'">
            <q-item-section>
              <q-item-label>
                Pickup location name:
                <b>{{ deliveryModalItem.pickupLocation.name }}</b>
              </q-item-label>
            </q-item-section>
          </q-item>
          <q-item v-if="deliveryModalItem.deliveryMode == 'Pickup'">
            <q-item-section>
              <q-item-label>
                Pickup location address: <br />
                <b>{{ deliveryModalItem.pickupLocation.address }}</b>
              </q-item-label>
            </q-item-section>
          </q-item>
          <q-item v-if="deliveryModalItem.deliveryMode == 'Delivery'">
            <q-item-section>
              <q-item-label>
                Delivery Type: <b>{{ deliveryModalItem.deliveryType }}</b>
              </q-item-label>
            </q-item-section>
          </q-item>
          <q-item v-if="deliveryModalItem.deliveryMode == 'Delivery'">
            <q-item-section>
              <q-item-label>
                Name: <b>{{ deliveryModalItem.shippedTo.name }}</b>
              </q-item-label>
            </q-item-section>
          </q-item>
          <q-item v-if="deliveryModalItem.deliveryMode == 'Delivery'">
            <q-item-section>
              <q-item-label>
                Street: <b>{{ deliveryModalItem.shippedTo.street }}</b>
              </q-item-label>
            </q-item-section>
          </q-item>
          <q-item v-if="deliveryModalItem.deliveryMode == 'Delivery'">
            <q-item-section>
              <q-item-label>
                City: <b>{{ deliveryModalItem.shippedTo.city }}</b>
              </q-item-label>
            </q-item-section>
          </q-item>
          <q-item v-if="deliveryModalItem.deliveryMode == 'Delivery'">
            <q-item-section>
              <q-item-label>
                State: <b>{{ deliveryModalItem.shippedTo.state }}</b>
              </q-item-label>
            </q-item-section>
          </q-item>
          <q-item v-if="deliveryModalItem.deliveryMode == 'Delivery'">
            <q-item-section>
              <q-item-label>
                Country: <b>{{ deliveryModalItem.shippedTo.country }}</b>
              </q-item-label>
            </q-item-section>
          </q-item>
          <q-item v-if="deliveryModalItem.deliveryMode == 'Delivery'">
            <q-item-section>
              <q-item-label>
                Zipcode: <b>{{ deliveryModalItem.shippedTo.zipcode }}</b>
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-card-section>
        <q-card-action>
          <q-btn flat label="Cancel" v-close-popup />
        </q-card-action>
      </q-card>
    </q-dialog>
  </div>
</template>

<script>
import { defineComponent, ref } from "vue";
import {
  getToShipPackages,
  markAsReadyToShipped,
  maskAsShipped,
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
    const confirmationModal = ref(false);
    const deliveryModal = ref(false);
    const selectedPackage = ref({});
    const deliveryModalItem = ref({});

    getToShipPackages($store.state.auth.jwt, $store.state.auth.warehouse).then(
      (result) => {
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
      }
    );

    return {
      packages,
      refresh,
      selectedPackage,
      confirmationModal,
      deliveryModal,
      deliveryModalItem,
      shipStatusPackage({ reset }, id, shipmentUID) {
        selectedPackage.value = {
          id,
          shipmentUID,
        };
        confirmationModal.value = true;
        reset();
      },
      markAsReadyToShip() {
        let data = new FormData();
        data.set("id", selectedPackage.value.id);
        markAsReadyToShipped(
          $store.state.auth.jwt,
          $store.state.auth.warehouse,
          data
        ).then((result) => {
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
          confirmationModal.value = false;
        });
      },
      deliveryInfoModal(item) {
        deliveryModalItem.value = item;
        deliveryModal.value = true;
      },
      refreshContent(done) {
        getToShipPackages(
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
    };
  },
});
</script>
