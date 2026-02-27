<script setup>
defineProps({
  msg: {
    type: String,// тип - строка
    required: true,// обязательный пропс
  },
})
</script>

<template>
  <div class="greetings">
    <h1 class="green">{{ msg }}</h1>
    <h3>
      You’ve successfully created a project with
      <a href="https://vite.dev/" target="_blank" rel="noopener">Vite</a> +
      <a href="https://vuejs.org/" target="_blank" rel="noopener">Vue 3</a>.
    </h3>
  </div>
</template>

<style scoped>
/* стили для заголовка первого уровня */
h1 {
  font-weight: 500;
  font-size: 2.6rem;
  position: relative;
  top: -10px;
}
/* стили для заголовка третьего уровня */
h3 {
  font-size: 1.2rem;
}
/* центрирование текста в контейнере greetings */
.greetings h1,
.greetings h3 {
  text-align: center;
}
/* медиа-запрос для экранов шире 1024px */
@media (min-width: 1024px) {
  .greetings h1,
  .greetings h3 {
    text-align: left;/* выравнивание текста по левому краю */
  }
}
</style>
