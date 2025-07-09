<template>
  <Button size="l" v-if="project.login" @click="copyAccess" title="Копировать доступ для отправки">
    Скопировать доступ
    <ClipboardTickIcon v-if="isCopy" />
    <ClipboardKeyIcon v-else />
  </Button>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { getUrlAdminLogin } from "@/utils/cms-api";
import ClipboardKeyIcon from "@/components/icons/ClipboardKeyIcon.vue";
import ClipboardTickIcon from "@/components/icons/ClipboardTickIcon.vue";
import Button from "@/components/ui/Button.vue";

const props = defineProps<{
  project: Project;
}>();

const isCopy = ref(false);

const copyAccess = () => {
  navigator.clipboard
    .writeText(
      `
${props.project.name}

${getUrlAdminLogin(props.project.url, props.project.urlAdmin, props.project.cms)}

login: ${props.project.login}
password: ${props.project.password}
`,
    )
    .then(() => {
      isCopy.value = true;
      setTimeout(() => {
        isCopy.value = false;
      }, 2000);
    });
};
</script>
