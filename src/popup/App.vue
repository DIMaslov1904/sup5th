<script setup>
import { ref } from 'vue'
import Layout from './components/Layout.vue'
import Site from './views/Site.vue'
import Projects from './views/Projects.vue'
import Settings from './views/Settings.vue'

const view = ref('site')
const viewList = [
  {
    label: 'Сайт',
    name: 'site'
  },
  {
    label: 'Проекты',
    name: 'projects'
  },
  {
    label: 'Настройки',
    name: 'settings'
  }
]
</script>
<template>
  <Layout v-model="view" :menuList="viewList">
    <Site v-if="view === 'site'" />
    <Projects v-if="view === 'projects'" />
    <Settings v-if="view === 'settings'" />
  </Layout>
</template>
