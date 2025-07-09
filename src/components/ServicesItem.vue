<template>
  <div class="services-item">
    <Button size="l" class="services-item__favorite" :class="{ 'services-item__favorite_added': ifFavorite }"
      @click.stop="$emit('setFavorites')">
      <ArchiveTickIcon class="services-item__favorite-icon" type="all" />
    </Button>
    <p>{{ services.description }}</p>
    <a class="services-item__link" :href="'https://' + services.url" target="_blank">{{ services.name }}</a>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue';
import ArchiveTickIcon from '@/components/icons/ArchiveTickIcon.vue';

defineProps<{
  services: ServicesItem
  ifFavorite: boolean
}>()
defineEmits<{
  setFavorites: []
}>()
</script>

<style lang="scss">
.services-item {
  padding-right: 44px;
  font-size: 14px;
  height: 100%;
  min-height: 65px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;

  &:not(:hover) {
    .services-item__favorite {
      opacity: 0;
    }
  }
}

.services-item__favorite {
  transition: opacity .2s;
  padding: 5px 10px;
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1;

  &:hover {
    &:not(.services-item__favorite_added) {
      .add {
        opacity: 1;
      }
    }

    &.services-item__favorite_added {
      .added {
        opacity: 0;
      }

      .remove {
        opacity: 1;
      }
    }
  }
}

.services-item__favorite-icon {

  .added,
  .remove,
  .add {
    opacity: 0;
  }
}

.services-item__favorite_added {
  .services-item__favorite-icon {
    .added {
      opacity: 1;
    }
  }
}


.services-item__link {
  color: currentColor;
  text-decoration: none;
  font-weight: bold;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
  }
}
</style>