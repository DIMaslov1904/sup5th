<script setup>
import { ref } from 'vue'
import LeftMenu from '../components/LeftMenu.vue'

const menuItem = ref('project')
const menuList = [
    {
        label: 'Проект',
        name: 'project'
    },
    {
        label: 'SEO',
        name: 'seo'
    },
    {
        label: 'Доступы',
        name: 'access'
    }
]
</script>
<template>
    <LeftMenu v-model="menuItem" :menuList="menuList" />

    Сайт

</template>
