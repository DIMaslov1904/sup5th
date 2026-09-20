<script setup>
const modelItemMenu = defineModel()
const props = defineProps(['menuList'])
</script>
<template>
    <nav class="fixed left-0 top-1/3 -translate-x-1/2 group ml-7 mx-auto flex rotate-90 w-fit gap-1.5 p-1 rounded-full isolate border border-white/10 bg-[#1e293bf2] transition-[margin,gap] duration-450 not-hover:gap-0.5 not-hover:ml-2 shadow before:absolute before:-bottom-2 before:w-full before:h-4 before:left-0 before:-z-10"
        id="menu">
        <button v-for="menuItem in menuList" @click="modelItemMenu = menuItem.name"
            class="px-4 py-2 rounded-full text-sm font-semibold transition-[background-color,color,padding,font-size] duration-200 hover:bg-white/10 hover:text-white not-group-hover:px-3 not-group-hover:py-1 not-group-hover:text-xs cursor-pointer"
            :class="{ 'bg-[#60a5fa1a] text-[#60a5fa] pointer-events-none': modelItemMenu === menuItem.name }">
            {{ menuItem.label }}
        </button>
    </nav>
</template>
