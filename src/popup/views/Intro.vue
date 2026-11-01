<script setup>
import Button from '../components/ui/Button.vue'

const emit = defineEmits(['skip', 'setup'])
</script>
<template>
    <main class="ui-background relative flex h-full flex-col items-center justify-center overflow-hidden px-8 text-ui-text">
        <div aria-hidden="true" class="pointer-events-none absolute inset-0">
            <span class="ui-intro-float absolute -top-24 -left-16 size-72 rounded-full bg-ui-accent/20 blur-3xl"></span>
            <span class="ui-intro-float absolute top-1/3 -right-20 size-80 rounded-full bg-ui-primary/15 blur-3xl" style="animation-delay: -6s"></span>
            <span class="ui-intro-float absolute -bottom-28 left-1/4 size-64 rounded-full bg-ui-success/10 blur-3xl" style="animation-delay: -12s"></span>
        </div>
        <div class="relative z-10 flex w-full max-w-xs flex-col items-center text-center">
            <p class="ui-intro-appear text-xs font-semibold tracking-[0.25em] text-ui-accent uppercase">SUP 5th</p>
            <h1 class="ui-intro-appear mt-3 text-2xl leading-8 font-semibold" style="animation-delay: 150ms">Проекты, доступы<br>и SEO — под рукой</h1>
            <p class="ui-intro-appear mt-3 text-xs leading-5 text-ui-muted" style="animation-delay: 300ms">Подключите API, чтобы расширение само получало проекты и доступы. Это можно сделать и позже в настройках.</p>
            <div class="ui-intro-appear mt-8 grid w-full gap-2.5" style="animation-delay: 450ms">
                <Button variant="primary" @click="emit('setup')">Настроить получение доступов</Button>
                <Button variant="ghost" @click="emit('skip')">Начать без настроек</Button>
            </div>
        </div>
    </main>
</template>
