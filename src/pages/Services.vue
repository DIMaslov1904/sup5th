<template>
  <div class="services__loading" v-if="servicesStore.isLoading">Загрузка</div>
  <div class="services" v-else>
    <header class="services__header">
      <Search v-model="searchComputed" />
      <Button @click="servicesStore.update">Обновить</Button>
    </header>
    <ul class="services__list">

      <li class="services__item services__item_personal">
        <Button class="services__item_personal-add" v-if="!servicesStore.state.personal"
          @click="isShowModal = true">Заполнить сслыку на личную таблицу доступов</Button>
        <template v-else>
          <a class="services__item_personal-link" :href="'https://' + servicesStore.state.personal"
            target="_blank">Личная
            таблица доступов</a>
          <Button size="l" class="services__item_personal-edit" @click="isShowModal = true">
            <EditIcon />
          </Button>
        </template>

      </li>

      <li v-if="servicesStore.state.favourites.url" class="services__item">
        <ServicesItem ifFavorite :services="servicesStore.state.favourites"
          @setFavorites="servicesStore.chandeFavorites()" />
      </li>

      <li v-for="services in getListSetFilters()" :class="services.url ? 'services__item' : 'services__group'">
        <ServicesItem v-if="services.url" :services :ifFavorite="servicesStore.state.favourites.url === services.url"
          @setFavorites="servicesStore.chandeFavorites(servicesStore.state.favourites.url === services.url ? null : services)" />
        <div v-else>{{ services.name }}</div>
      </li>

    </ul>
  </div>

  <Modal :isShowModal @close="isShowModal = false">
    <Textarea class="input-personal" v-model="personalLink" placeholder="url до гугл таблици с личными доступами" />
  </Modal>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import switcher from '@/utils/switcher'
import { useServicesStore } from '@/stores';
import Button from '@/components/ui/Button.vue';
import ServicesItem from '@/components/ServicesItem.vue'
import Search from '@/components/ui/Search.vue'
import EditIcon from '@/components/icons/EditIcon.vue'
import Modal from '@/components/Modal.vue';
import Textarea from '@/components/ui/Textarea.vue';


const servicesStore = useServicesStore()
const search = ref('')
const searchRU = ref('')
const searchEN = ref('')
const isShowModal = ref(false)

onMounted(async () => {
  await servicesStore.loadFromStorage()
  servicesStore.state.list.length === 0 && servicesStore.update()
})

const personalLink = computed({
  get: () => servicesStore.state.personal,
  set: (newValue: string) => {
    servicesStore.changePersonal(newValue.replace('http://', '').replace('https://', ''))
  }
});

const searchComputed = computed({
  get: () => search.value,
  set: (newValue: string) => {
    newValue = newValue.toLowerCase()
    searchRU.value = switcher(newValue)
    searchEN.value = searchRU.value === newValue ? switcher(newValue, { type: 'rueng' }) : ''
    search.value = newValue
  }
});

const fitrelServices = (item: ServicesItem | ServicesGroup) => {
  const name = item.name.toLowerCase()
  const description = 'description' in item ? item.description.toLowerCase() : ''
  if (searchEN.value) return name.includes(search.value) || description.includes(search.value) || name.includes(searchEN.value) || description.includes(searchEN.value)
  return name.includes(search.value) || description.includes(search.value) || name.includes(searchRU.value)
}

const getListSetFilters = () => search.value ? servicesStore.state.list.filter(fitrelServices) : servicesStore.state.list

</script>

<style lang="scss">
.services__loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
}

.services {
  display: grid;
  gap: 10px;
}

.services__header {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 10px;
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--color-bg-body);
  padding: 5px;
}

.services__list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  list-style: none;
  padding: 10px;
}

.services__group {
  grid-column: 1/3;
  background-color: rebeccapurple;
  color: var(--color-text-primary);
  padding: 10px;
  border-radius: 8px;
  border: 1px solid var(--color-secondaty-hover);
}

.services__item {
  position: relative;
  background-color: var(--color-secondary);
  padding: 10px;
  border-radius: 8px;
  border: 1px solid var(--color-secondaty-hover);
  box-shadow: 0 0 10px rgba(0 0 0 / .3);
  transition-property: box-shadow;
  transition-duration: .2s;
  overflow: hidden;

  &:hover {
    box-shadow: 0 0 10px rgba(255 255 255 / .3);
  }
}

.services__item_personal {
  padding-right: 44px;
  font-size: 14px;
  height: 100%;
  min-height: 86.3px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;

  &:not(:hover) {
    .services__item_personal-edit {
      opacity: 0;
    }
  }
}

.services__item_personal-edit {
  transition: opacity .2s;
  padding: 5px 10px;
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1;
}

.services__item_personal-link {
  color: currentColor;
  text-decoration: none;
  font-weight: bold;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
  }
}

.input-personal {
  width: 280px;
  height: 67px;
  resize: none;
}

.services__item_personal-add {
  height: 100%;
  width: calc(100% + 34px);
}
</style>