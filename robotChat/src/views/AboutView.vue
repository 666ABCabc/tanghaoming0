<template>
  <div class="about">
    <h1>This is an about page</h1>
  </div>
</template>

<style>
/* Медиа-запрос для устройств с шириной экрана от 1024px и выше (десктопы) */
@media (min-width: 1024px) {
  .about {
    min-height: 100vh;/* Минимальная высота = 100% высоты окна браузера */
    display: flex; /* Использование flexbox для центрирования */
    align-items: center;/* Вертикальное центрирование содержимого */
  }
}
</style>
