<script setup>
import { onMounted, ref } from 'vue'
import { loadProjectData } from '../data/projectData'

const projects = ref([])
const updatedAt = ref(null)

onMounted(async () => {
    const data = await loadProjectData()
    projects.value = data.projects
    updatedAt.value = data.updatedAt
})
</script>

<template>
    <section class="w-full px-4 pt-5 text-slate-200">
        <div class="flex items-center justify-between mb-4">
            <h1 class="text-lg font-semibold">Проекты</h1>
            <span class="text-xs text-slate-400">{{ projects.length }}</span>
        </div>
        <p v-if="!projects.length" class="text-sm text-slate-400">Проекты еще не загружены</p>
        <div v-else class="grid gap-2">
            <article v-for="project in projects" :key="project.url"
                class="rounded-lg border border-white/10 bg-slate-900/40 p-3">
                <div class="flex items-center justify-between gap-3">
                    <h2 class="text-sm font-medium">{{ project.name || project.url }}</h2>
                    <span v-if="project.login" class="text-xs text-emerald-400">доступ есть</span>
                </div>
                <p class="mt-1 text-xs text-slate-400">{{ project.url }}</p>
            </article>
        </div>
        <p v-if="updatedAt" class="mt-4 text-xs text-slate-500">Обновлено: {{ new Date(updatedAt).toLocaleString() }}
        </p>
    </section>
</template>
