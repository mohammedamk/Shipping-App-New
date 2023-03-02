<template>
  <div
    class="bg-black window-height window-width row justify-center items-center"
  >
    <div class="column">
      <div class="row">
        <h5 class="text-h5 text-white q-my-md">Kaizen Logistics | Shipping</h5>
      </div>
      <div class="row">
        <q-card dark square bordered class="q-pa-lg shadow-1">
          <q-card-section dark>
            <q-form dark class="q-gutter-md">
              <q-input
                dark
                square
                filled
                clearable
                v-model="email"
                type="email"
                label="email"
              />
              <q-input
                dark
                square
                filled
                clearable
                v-model="password"
                type="password"
                label="password"
              />
              <q-select
                dark
                option-value="id"
                option-label="name"
                v-model="warehouse"
                :options="warehouses"
                label="Select warehouse"
              />
            </q-form>
          </q-card-section>
          <q-card-actions class="q-px-md">
            <q-btn
              unelevated
              color="black"
              size="lg"
              class="full-width"
              label="Login"
              @click="login"
            />
          </q-card-actions>
        </q-card>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent, ref } from "vue";
import { login, getWarehouses } from "src/services/logisticService";
import { useQuasar } from "quasar";
import { useRouter } from "vue-router";
import { useStore } from "vuex";

export default defineComponent({
  name: "PageLogin",

  setup() {
    const email = ref(null);
    const password = ref(null);
    const quasar = useQuasar();
    const router = useRouter();
    const warehouse = ref(null);
    const $store = useStore();
    const warehouses = ref([]);

    if ($store.state.auth.jwt) {
      router.push({ name: "ConfirmationPackages" })
    }

    getWarehouses()
      .then((result) => {
        if (result.status === "success") {
          warehouses.value = result.message;
        } else {
          quasar.notify({
            type: "negative",
            message: result.message,
          });
        }
      })
      .catch((err) => {
        quasar.notify({
          type: "negative",
          message: err.message,
        });
      });

    return {
      email,
      password,
      warehouse,
      warehouses,
      async login() {
        let data = new FormData();
        data.set("email", email.value);
        data.set("password", password.value);
        let result = await login(data);
        if (result.status === "success") {
          $store.commit("auth/setJwt", result.message);
          $store.commit("auth/setWarehouse", warehouse.value.id);
          router.push({ name: "ConfirmationPackages" });
        } else {
          quasar.notify({
            type: "negative",
            message: result.message,
          });
        }
      },
    };
  },
});
</script>
