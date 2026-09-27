<script setup>
const modelItemMenu = defineModel()
const props = defineProps(['menuList'])
</script>
<template>
    <div
        class="bg-linear-[135deg,#0f172a,0%,#1e293b,30%,#334155,60%,#1e293b] before:fixed before:inset-[35%] before:block before:rounded-full before:blur-2xl before:bg-white/15 flex flex-col min-h-screen w-full text-[#94a3b8] before:-z-10 overflow-hidden h-full">
        <nav class="fixed left-1/2 -translate-x-1/2 flex w-fit p-1 rounded-full isolate border border-white/10 bg-[#1e293bf2] transition-[margin,gap] duration-450 gap-0.5 mt-2 shadow z-10"
            id="menu">
            <button v-for="menuItem in menuList" @click="modelItemMenu = menuItem.name"
                class="rounded-full font-semibold transition-[background-color,color,padding,font-size] duration-200 hover:bg-white/10 hover:text-white px-3 py-1 text-xs cursor-pointer"
                :class="{ 'bg-[#60a5fa1a] text-[#60a5fa] pointer-events-none': modelItemMenu === menuItem.name }">
                {{ menuItem.label }}
            </button>
        </nav>
        <div class="overflow-y-auto pt-16 h-full">
            <slot />
        </div>
    </div>
</template>
