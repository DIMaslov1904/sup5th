<template>
  <h1 class="audit__title">Аудит сайта</h1>

  <Button href="https://loading.express/" target="_blank"
    >LOADING.express</Button
  >
  <Button
    :href="'https://pagespeed.web.dev/analysis?url=' + currentTabUrl"
    target="_blank"
    >PageSpeed Insights</Button
  >
  <Button
    :href="'https://validator.w3.org/nu/?doc=' + currentTabUrl"
    target="_blank"
    >валидатор HTML</Button
  >
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import Button from "@/components/ui/Button.vue";
import { getCurrentTab } from "@/utils/chrome-api";

const currentTabUrl = ref("");
onMounted(async () => {
  const curTab = await getCurrentTab();
  if (!curTab || !curTab.url) return;
  currentTabUrl.value = curTab.url;
});
</script>

<style lang="scss">
.audit__title {
  text-align: center;
}
</style>
