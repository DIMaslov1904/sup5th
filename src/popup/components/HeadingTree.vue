<script setup>
defineProps({ nodes: { type: Array, default: () => [] }, nested: Boolean })
const emit = defineEmits(['select'])
</script>
<template>
    <ul class="grid gap-2" :class="nested ? 'mt-2 ml-3 border-l border-ui-border pl-3' : ''">
        <li v-for="node in nodes" :key="node.id" class="min-w-0">
            <div class="relative">
                <span v-if="nested" aria-hidden="true" class="absolute -left-3 top-1/2 w-3 border-t border-ui-border"></span>
                <button type="button" :aria-label="`Перейти к H${node.level}: ${node.text || 'пустой заголовок'}`" class="w-full cursor-pointer rounded-panel border border-ui-border/70 bg-ui-panel/90 p-2 text-left text-xs text-ui-text transition-colors hover:border-ui-accent/40 hover:bg-ui-accent/10" @click="emit('select', node)">
                    <b class="mr-2 text-ui-accent">H{{ node.level }}</b><span class="break-words">{{ node.text || '(пустой)' }}</span>
                </button>
            </div>
            <HeadingTree v-if="node.children.length" :nodes="node.children" nested @select="emit('select', $event)" />
        </li>
    </ul>
</template>
