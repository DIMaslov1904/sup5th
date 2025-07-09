<template>
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.4271 2.66669H9.57379C6.73379 2.66669 4.42712 4.98669 4.42712 7.81335V26.6C4.42712 29 6.14712 30.0134 8.25379 28.8534L14.7604 25.24C15.4538 24.8534 16.5738 24.8534 17.2538 25.24L23.7604 28.8534C25.8671 30.0267 27.5871 29.0134 27.5871 26.6V7.81335C27.5738 4.98669 25.2671 2.66669 22.4271 2.66669Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path class="added" v-if=" type === 'added' || type === 'all'" opacity="0.4" d="M12.7865 14.6667L14.7864 16.6667L20.1198 11.3333" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path class="remove" v-if="type === 'remove' || type === 'all'" opacity="0.4" d="M19.3333 14.1999H12.6666" stroke="currentColor" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>
    <path class="add" v-if="type === 'add' || type === 'all'" opacity="0.4" d="M12.67 14.195H19.34M16.005 17.53V10.86" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>
</template>

<script setup lang="ts">
defineProps<{
  type?: 'add' | 'remove' | 'added' | 'all'
}>()
</script>