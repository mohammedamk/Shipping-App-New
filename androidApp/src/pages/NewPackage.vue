<template>
  <div>
    <q-tabs v-model="pageTab">
      <q-tab name="newPackage" label="New Package" />
      <q-tab name="arrivedPackage" label="Arrived Package" />
    </q-tabs>
    <q-form
      v-if="pageTab == 'newPackage'"
      @submit="createPckg"
      @reset="formReset('newPackage')"
      greedy
      autofocus
    >
      <q-select
        v-model="state.uID"
        :options="filteredUIDs.map((v) => uIDFormat(v.uID, v.name))"
        label="Input user ID"
        use-input
        input-debounce="0"
        @filter="filterUIDs"
        :error-message="v$.uID.$error ? v$.uID.$errors[0].$message : ''"
        :error="v$.uID.$error"
      ></q-select>
      <q-input :model-value="name" :disable="true" label="Customer name" />
      <q-input
        v-model="state.trackingNumber"
        label="Tracking Number"
        :error-message="
          v$.trackingNumber.$error ? v$.trackingNumber.$errors[0].$message : ''
        "
        :error="v$.trackingNumber.$error"
      />
      <div>
        <q-btn label="Submit" type="submit" color="primary" />
        <q-btn
          label="Reset"
          type="reset"
          color="primary"
          flat
          class="q-ml-sm"
        />
      </div>
    </q-form>
    <q-form
      v-if="pageTab == 'arrivedPackage'"
      @submit="markPckAsArrived"
      @reset="formReset('arrivedPackage')"
      greedy
      autofocus
    >
      <q-input
        v-model="arrivalState.trackingNumber"
        label="Tracking Number"
        :error-message="
          arrivalv$.trackingNumber.$error
            ? arrivalv$.trackingNumber.$errors[0].$message
            : ''
        "
        :error="arrivalv$.trackingNumber.$error"
      />
      <q-input
        :model-value="arrivalName"
        :disable="true"
        label="Customer name"
      />
      <q-input
        :model-value="arrivalState.uID"
        :disable="true"
        label="Customer uID"
      />
      <div>
        <q-btn
          v-if="arrivalState.uID"
          label="Submit"
          type="submit"
          color="primary"
        />
        <q-btn
          v-if="!arrivalState.uID && !failedCheck"
          label="Check"
          type="submit"
          @click="checkPackage"
          color="secondary"
        />
        <q-btn
          v-if="failedCheck"
          label="New Package"
          type="submit"
          @click="toNewPackage"
          color="red"
        />
        <q-btn
          label="Reset"
          type="reset"
          color="primary"
          flat
          class="q-ml-sm"
        />
      </div>
      <div v-if="failedCheck">
        <p>
          <span style="color: red"
            ><b
              >Check failed for the tracking number
              {{ arrivalState.trackingNumber }}</b
            ></span
          >
          <br />
        </p>
      </div>
    </q-form>
  </div>
</template>

<script>
import { defineComponent, ref, reactive, watch } from "vue";
import {
  getCustomers,
  createPackage,
  getPackageByTrackingNumber,
  markPackageAsArrived,
} from "src/services/logisticService";
import { useQuasar } from "quasar";
import { useStore } from "vuex";
import { useRouter } from "vue-router";
import { required, alphaNum } from "@vuelidate/validators";
import { useVuelidate } from "@vuelidate/core";

export default defineComponent({
  setup() {
    const quasar = useQuasar();
    const $store = useStore();
    const router = useRouter();

    const uIDs = ref([]);
    const filteredUIDs = ref([]);

    const state = reactive({
      trackingNumber: "",
      uID: "",
    });

    const arrivalState = reactive({
      trackingNumber: "",
      uID: "",
    });

    const rules = {
      trackingNumber: { required, alphaNum },
      uID: { required },
    };

    const arrivalRules = {
      trackingNumber: {
        required,
        alphaNum,
      },
    };

    const v$ = useVuelidate(rules, state);

    const arrivalv$ = useVuelidate(arrivalRules, arrivalState);

    const name = ref(null);
    const arrivalName = ref(null);

    const pageTab = ref("arrivedPackage");

    const formReset = (formName) => {
      if (formName == "newPackage") {
        state.uID = "";
        state.trackingNumber = "";
        name.value = "";
        v$.value.$reset();
      } else {
        arrivalState.uID = "";
        arrivalState.trackingNumber = "";
        arrivalName.value = null;
        arrivedPackageID.value = null;
        failedCheck.value = false;
        arrivalv$.value.$reset();
      }
    };

    watch(state, (newVal, _oldVal) => {
      if (newVal.uID) {
        name.value = filteredUIDs.value.find(
          (v) => v.uID === newVal.uID.slice(0, 6)
        )?.name;
      }
    });

    watch(pageTab, (_newVal, oldVal) => {
      if (oldVal) {
        formReset(oldVal);
      }
    });

    getCustomers($store.state.auth.jwt)
      .then((result) => {
        if (result.status === "success") {
          uIDs.value = result.message;
          filteredUIDs.value = result.message;
        } else {
          if (result.unauthorized) {
            router.push({ name: "Login" });
          } else {
            quasar.notify({
              type: "negative",
              message: result.message,
            });
          }
        }
      })
      .catch((err) => {
        quasar.notify({
          type: "negative",
          message: err.message,
        });
      });

    const uIDFormat = (uID, name) => {
      return `${uID}${name
        .split(" ")
        .map((v) => v.charAt(0).toUpperCase())
        .join("")}`;
    };

    const failedCheck = ref(false);
    const arrivedPackageID = ref(null);

    return {
      uIDs,
      name,
      filteredUIDs,
      state,
      v$,
      arrivalState,
      arrivalv$,
      pageTab,
      arrivalName,
      failedCheck,
      arrivedPackageID,
      checkPackage() {
        arrivalv$.value.$validate().then(async (success) => {
          if (success) {
            const result = await getPackageByTrackingNumber(
              $store.state.auth.jwt,
              arrivalState.trackingNumber
            );
            if (result.status == "success") {
              arrivalName.value = result.message.customerName;
              arrivalState.uID = result.message.uID;
              arrivedPackageID.value = result.message.id;
            } else {
              if (result.notFound) {
                failedCheck.value = true;
              } else {
                quasar.notify({
                  type: "negative",
                  message: result.message,
                });
              }
            }
          }
        });
      },
      markPckAsArrived() {
        arrivalv$.value.$validate().then(async (success) => {
          if (success && arrivalState.uID && !failedCheck.value) {
            const data = new FormData();
            data.set("id", arrivedPackageID.value);
            const result = await markPackageAsArrived(
              $store.state.auth.jwt,
              data
            );
            if (result.status == "success") {
              formReset("arrivedPackage");
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
          }
        });
      },
      toNewPackage() {
        arrivalv$.value.$validate().then((success) => {
          if (success) {
            pageTab.value = "newPackage";
            failedCheck.value = false;
            state.trackingNumber = arrivalState.trackingNumber;
            formReset("arrivedPackage");
          }
        });
      },
      createPckg() {
        v$.value.$validate().then((success) => {
          if (success) {
            const data = new FormData();

            data.set("trackingNumber", state.trackingNumber);
            data.set(
              "userID",
              filteredUIDs.value.find((v) => v.uID === state.uID.slice(0, 6))
                ?.id
            );
            data.set("warehouse", $store.state.auth.warehouse);

            createPackage($store.state.auth.jwt, data)
              .then((result) => {
                if (result.status === "success") {
                  quasar.notify({
                    type: "positive",
                    message: result.message,
                  });
                  formReset("newPackage");
                } else {
                  if (result.unauthorized) {
                    router.push({ name: "Login" });
                  } else {
                    quasar.notify({
                      type: "negative",
                      message: result.message,
                    });
                  }
                }
              })
              .catch((err) => {
                quasar.notify({
                  type: "negative",
                  message: err.message,
                });
              });
          }
        });
      },
      formReset,
      uIDFormat,
      filterUIDs(val, update, abort) {
        setTimeout(() => {
          update(() => {
            if (val === "") {
              filteredUIDs.value = uIDs.value;
            } else {
              filteredUIDs.value = uIDs.value.filter(
                (v) =>
                  uIDFormat(v.uID, v.name)
                    .toLowerCase()
                    .indexOf(val.toLowerCase()) >= 0
              );
            }
          });
        }, 800);
      },
    };
  },
});
</script>
