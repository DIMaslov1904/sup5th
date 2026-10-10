<script setup>
const modelItemMenu = defineModel()
const props = defineProps(['menuList'])
</script>
<template>
    <nav class="fixed left-0 top-1/3 -translate-x-1/2 group ml-2 mx-auto flex rotate-90 w-fit p-1 rounded-full isolate border border-white/10 bg-[#1e293bf2] transition-[margin,gap] duration-450  shadow"
        id="menu">
        <button v-for="menuItem in menuList" @click="modelItemMenu = menuItem.name"
            class="rounded-full font-semibold transition-[background-color,color,padding,font-size] duration-200 hover:bg-white/10 hover:text-white px-3 py-1 text-xs cursor-pointer"
            :class="{ 'bg-[#60a5fa1a] text-[#60a5fa] pointer-events-none': modelItemMenu === menuItem.name }">
            {{ menuItem.label }}
        </button>
    </nav>
</template>
