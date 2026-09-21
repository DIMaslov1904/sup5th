<script setup>
const modelItemMenu = defineModel()
const props = defineProps(['menuList'])
</script>
<template>
    <div
        class="bg-linear-[135deg,#0f172a,0%,#1e293b,30%,#334155,60%,#1e293b] before:fixed before:inset-[35%] before:block before:rounded-full before:blur-2xl before:bg-white/15 flex flex-col pt-6.5 min-h-screen w-full text-[#94a3b8]">
        <nav class="fixed top-0 -translate-x-1/2 left-1/2 group mt-1 flex w-fit gap-1.5 p-1 rounded-full isolate border border-white/10 bg-[#1e293bf2] transition-[margin,gap] duration-450 not-hover:gap-0.5 not-hover:-mt-2 shadow before:absolute before:-top-2 before:w-full before:h-4 before:left-0 before:-z-10 z-10"
            id="menu">
            <button v-for="menuItem in menuList" @click="modelItemMenu = menuItem.name"
                class="px-4 py-2 rounded-full text-sm font-semibold transition-[background-color,color,padding,font-size] duration-200 hover:bg-white/10 hover:text-white not-group-hover:px-3 not-group-hover:py-1 not-group-hover:text-xs cursor-pointer"
                :class="{ 'bg-[#60a5fa1a] text-[#60a5fa] pointer-events-none': modelItemMenu === menuItem.name }">
                {{ menuItem.label }}
            </button>
        </nav>
        <slot />
    </div>
</template>
