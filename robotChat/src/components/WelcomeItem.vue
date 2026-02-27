<template>
  <div class="item">
    <i>
      <!-- Контейнер для иконки с использованием именованного слота -->
      <slot name="icon"></slot>
    </i>
      <!-- Блок с деталями элемента -->
    <div class="details">
      <h3>
        <!-- Заголовок через именованный слот -->
        <slot name="heading"></slot>
      </h3>
      <slot></slot>
      <!-- Основное содержимое через слот по умолчанию -->
    </div>
  </div>
</template>

<style scoped>
/* Стили для элемента приветствия/списка */
.item {
  margin-top: 2rem;
  display: flex;
  position: relative;
}
/* Блок с деталями занимает оставшееся пространство */
.details {
  flex: 1;
  margin-left: 1rem;
}
/* Контейнер для иконки */
i {
  display: flex;
  place-items: center;
  place-content: center;
  width: 32px;
  height: 32px;
  color: var(--color-text);
}
/* Стили заголовка */
h3 {
  font-size: 1.2rem;
  font-weight: 500;
  margin-bottom: 0.4rem;
  color: var(--color-heading);
}
/* Медиа-запрос для больших экранов (десктоп) */
@media (min-width: 1024px) {
  .item {
    margin-top: 0;
    padding: 0.4rem 0 1rem calc(var(--section-gap) / 2);
  }
/* Иконка позиционируется абсолютно слева */
  i {
    top: calc(50% - 25px);
    left: -26px;
    position: absolute;
    border: 1px solid var(--color-border);
    background: var(--color-background);
    border-radius: 8px;
    width: 50px;
    height: 50px;
  }
 /* Вертикальная линия-соединитель перед элементом */
  .item:before {
    content: ' ';
    border-left: 1px solid var(--color-border);
    position: absolute;
    left: 0;
    bottom: calc(50% + 25px);
    height: calc(50% - 25px);
  }
/* Вертикальная линия-соединитель после элемента */
  .item:after {
    content: ' ';
    border-left: 1px solid var(--color-border);
    position: absolute;
    left: 0;
    top: calc(50% + 25px);
    height: calc(50% - 25px);
  }
 /* Убираем линию перед первым элементом */
  .item:first-of-type:before {
    display: none;
  }
 /* Убираем линию после последнего элемента */
  .item:last-of-type:after {
    display: none;
  }
}
</style>
