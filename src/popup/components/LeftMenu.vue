<script setup>
const modelItemMenu = defineModel()
const props = defineProps(['menuList'])
</script>
<template>
    <nav class="fixed left-0 top-1/3 -translate-x-1/2 group ml-2 mx-auto flex rotate-90 w-fit p-1 rounded-full isolate border border-ui-border bg-ui-panel/95 text-ui-muted transition-[margin,gap] duration-450 shadow"
        id="menu">
        <button v-for="menuItem in menuList" @click="modelItemMenu = menuItem.name"
            class="rounded-full font-semibold transition-[background-color,color,padding,font-size] duration-200 hover:bg-ui-text/10 hover:text-ui-text px-3 py-1 text-xs cursor-pointer"
            :class="{ 'bg-ui-accent/10 text-ui-accent pointer-events-none': modelItemMenu === menuItem.name }">
            {{ menuItem.label }}
        </button>
    </nav>
</template>
