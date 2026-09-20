<script setup>
const modelItemMenu = defineModel()
const props = defineProps(['menuList'])
</script>
<template>
    <div class="flex flex-col pt-6.5">
        <nav class="fixed top-0 -translate-x-1/2 left-1/2 group mt-1 flex w-fit gap-1.5 p-1 rounded-full isolate border border-blue-200 bg-white transition-[margin,gap] duration-450 not-hover:gap-0.5 not-hover:-mt-2 shadow before:absolute before:-top-2 before:w-full before:h-4 before:left-0 before:-z-10"
            id="menu">
            <button v-for="menuItem in menuList" @click="modelItemMenu = menuItem.name"
                class="px-4 py-2 rounded-full text-sm font-semibold transition-[background-color,padding,font-size] duration-200 hover:bg-blue-200 not-group-hover:px-3 not-group-hover:py-1 not-group-hover:text-xs cursor-pointer"
                :class="{ 'bg-blue-100': modelItemMenu === menuItem.name }">
                {{ menuItem.label }}
            </button>
        </nav>
        <slot />
    </div>
</template>
