<template>
  <div class="q-pa-md scroll">
    <q-pull-to-refresh @refresh="refreshContent" ref="refresh">
      <div class="text-h6 q-mb-md">Packages awaiting return</div>
      <q-list>
        <q-slide-item
          v-for="(item, index) in packages"
          :key="index"
          left-color="green"
          @left="(opt) => returnPackage(opt, item.id, item.trackingNumber)"
        >
          <template v-slot:left> <q-icon name="done" /> </template>
          <q-item>
            <q-item-section>
              <q-item-label>
                Tracking Number: <b>{{ item.trackingNumber }}</b></q-item-label
              >
              <q-item-label caption lines="4">
                <span class="ma-1"
                  >Client: <b>{{ item.name }}</b>
                </span>
                <br />
                createdAt: <b>{{ item.createdAt }}</b> <br />
                <br />
                <b style="color: green">Slide to right to confirm the return</b>
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-slide-item>
      </q-list>
    </q-pull-to-refresh>
    <q-dialog v-model="toReturn" persistent>
      <q-card>
        <q-card-section>
          <div class="text-h5">
            Returning {{ returningPackage.trackingNumber }}
          </div>
        </q-card-section>
        <q-card-section>
          <div class="text-h7">
            Are you sure you want to confirm the return of this package?
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
  getReturningPackages,
  markAsReturned,
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
    const toReturn = ref(false);
    const returningPackage = ref({});

    getReturningPackages(
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
      toReturn,
      returningPackage,
      refreshContent(done) {
        getReturningPackages(
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
      returnPackage({ reset }, id, trackingNumber) {
        returningPackage.value = { id, trackingNumber };
        toReturn.value = true;
        reset();
      },
      returnPackageComplete() {
        let data = new FormData();
        data.set("id", returningPackage.value.id);
        markAsReturned($store.state.auth.jwt, data).then((result) => {
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
          returningPackage.value = {};
        });
      },
    };
  },
});
</script>
