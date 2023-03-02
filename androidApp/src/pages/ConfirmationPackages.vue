<template>
  <div class="q-pa-md scroll">
    <q-pull-to-refresh @refresh="refreshContent" ref="refresh">
      <div class="text-h6 q-mb-md">Packages awaiting confirmation</div>
      <q-list>
        <q-slide-item
          v-for="(item, index) in packages"
          :key="index"
          right-color="red"
          left-color="green"
          @left="
            (opt) =>
              confirmPackage(
                opt,
                item.id,
                item.trackingNumber,
                item.deliveryMode,
                item.deliveryType
              )
          "
          @right="(opt) => returnPackage(opt, item.id, item.trackingNumber)"
        >
          <template v-slot:left> <q-icon name="done" /> </template>
          <template v-slot:right> <q-icon name="close" /> </template>
          <q-item>
            <q-item-section>
              <q-item-label>
                Tracking Number: <b>{{ item.trackingNumber }}</b></q-item-label
              >
              <q-item-label caption lines="5">
                <span class="ma-1"
                  >Client: <b>{{ item.name }}</b>
                </span>
                <br />
                createdAt: <b>{{ item.createdAt }}</b> <br />
                <br />
                <b style="color: green">Slide to right to confirm arrival</b>
                <br />
                <b style="color: red">Slide to left to return package</b>
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-slide-item>
      </q-list>
    </q-pull-to-refresh>
    <q-dialog
      v-model="confirmPackModal"
      persistent
      transition-show="scale"
      transition-hide="scale"
    >
      <q-card>
        <q-card-section>
          <div class="text-h6">
            Extra services for {{ selectedPackage.trackingNumber }}
          </div>
        </q-card-section>
        <q-card-section>
          <q-input v-model="weight" label="Weight" type="number" />
        </q-card-section>
        <q-card-section>
          <q-list bordered separator>
            <q-item
              v-for="(item, index) in filteredServices"
              :key="index"
              clickable
              @click="toggleService(item.id)"
              :active="selectedServices.includes(item.id)"
              active-class="bg-blue-4 text-dark"
            >
              <q-item-section>
                <q-item-label>
                  {{ item.name }}
                </q-item-label>
                <q-item-label caption>
                  Price type: {{ item.priceType }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                {{
                  item.priceType == "Declared Value"
                    ? `${item.price}%`
                    : `$${item.price}`
                }}
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
        <q-card-actions>
          <q-btn flat label="Confirm" @click="confirmPackageComplete" />
          <q-btn flat label="Cancel" @click="resetSelectServices" />
        </q-card-actions>
      </q-card>
    </q-dialog>
    <q-dialog v-model="toReturn" persistent>
      <q-card>
        <q-card-section>
          <div class="text-h5">
            Returning {{ returningPackage.trackingNumber }}
          </div>
        </q-card-section>
        <q-card-section>
          <div class="text-h7">
            Are you sure you want to return this package?
          </div>
        </q-card-section>
        <q-card-action>
          <q-btn flat label="Return" @click="returnPackageComplete" />
          <q-btn flat label="Cancel" v-close-popup />
        </q-card-action>
      </q-card>
    </q-dialog>
  </div>
</template>

<script>
import { defineComponent, ref } from "vue";
import {
  getConfirmationPackages,
  getServices,
  askDeclaredValue,
  markAsPreparedToReturn,
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
    const availableServices = ref([]);
    const filteredServices = ref([]);
    const confirmPackModal = ref(false);
    const selectedServices = ref([]);
    const selectedPackage = ref({});
    const weight = ref(0);
    const toReturn = ref(false);
    const returningPackage = ref({});

    getConfirmationPackages(
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

    getServices($store.state.auth.jwt, $store.state.auth.warehouse).then(
      (result) => {
        if (result.status === "success") {
          availableServices.value = result.message;
        } else {
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
      availableServices,
      confirmPackModal,
      selectedServices,
      selectedPackage,
      filteredServices,
      weight,
      toReturn,
      returningPackage,
      returnPackage({ reset }, id, trackingNumber) {
        returningPackage.value = { id, trackingNumber };
        toReturn.value = true;
        reset();
      },
      confirmPackage(
        { reset },
        id,
        trackingNumber,
        deliveryMode,
        deliveryType
      ) {
        selectedPackage.value = {
          id,
          trackingNumber,
        };
        filteredServices.value = availableServices.value.filter(
          (v) => v.deliveryMode === deliveryMode
        );
        if (deliveryMode === "Delivery") {
          filteredServices.value = filteredServices.value.filter(
            (v) => v.deliveryType === deliveryType
          );
        }
        console.log(filteredServices.value);
        confirmPackModal.value = true;
        reset();
      },
      refreshContent(done) {
        getConfirmationPackages(
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
      confirmPackageComplete() {
        let data = new FormData();
        data.set("id", selectedPackage.value.id);
        data.set("weight", weight.value);
        for (let i = 0; i < selectedServices.value.length; i++) {
          data.append("service", selectedServices.value[i]);
        }
        askDeclaredValue($store.state.auth.jwt, data).then((result) => {
          if (result.status === "success") {
            refresh.value.trigger();
            weight.value = 0;
            selectedServices.value = [];
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
          confirmPackModal.value = false;
        });
      },
      resetSelectServices() {
        selectedServices.value = [];
        selectedPackage.value = {};
        confirmPackModal.value = false;
      },
      toggleService(name) {
        if (selectedServices.value.includes(name)) {
          selectedServices.value = selectedServices.value.filter(
            (v) => v !== name
          );
        } else {
          selectedServices.value.push(name);
        }
      },
      returnPackageComplete() {
        let data = new FormData();
        data.set("id", returningPackage.value.id);
        markAsPreparedToReturn($store.state.auth.jwt, data).then((result) => {
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
        });
      },
    };
  },
});
</script>
