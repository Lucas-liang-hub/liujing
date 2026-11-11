<script setup>
import SceneCanvas from './SceneCanvas.vue';

defineProps({
  eyebrow: { type: String, default: '流境' },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
});
</script>

<template>
  <div class="auth">
    <SceneCanvas />

    <div class="auth-body">
      <section class="intro">
        <p class="eyebrow">{{ eyebrow }}</p>
        <h1 class="headline">看得见氛围<br />陪得了情绪<br />留得下数据</h1>
        <p class="lede">
          六个流动的夜晚，一个知道你在做什么的陪伴者。<br />
          每一次坐下，都会被记住。
        </p>
      </section>

      <section class="card glass">
        <header class="card-head">
          <h2>{{ title }}</h2>
          <p v-if="subtitle" class="sub">{{ subtitle }}</p>
        </header>
        <slot />
      </section>
    </div>
  </div>
</template>

<style scoped>
.auth {
  position: relative;
  height: 100%;
  overflow-y: auto;
}

.auth-body {
  position: relative;
  z-index: 10;
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(40px, 7vw, 120px);
  padding: 48px 32px;
  animation: fade-up 700ms cubic-bezier(0.22, 0.61, 0.36, 1) both;
}

.intro {
  max-width: 380px;
}

.eyebrow {
  font-family: var(--font-serif);
  font-size: 12px;
  letter-spacing: 0.5em;
  color: var(--accent);
  margin-bottom: 26px;
}

.headline {
  font-size: clamp(28px, 3.4vw, 40px);
  line-height: 1.5;
  letter-spacing: 0.1em;
  color: #f2f6fa;
  text-shadow: 0 0 40px rgba(0, 0, 0, 0.5);
}

.lede {
  margin-top: 22px;
  font-size: 13px;
  line-height: 2;
  color: var(--text-dim);
  letter-spacing: 0.04em;
}

.card {
  width: min(380px, 100%);
  padding: 32px 30px 28px;
  box-shadow: var(--shadow);
}

.card-head h2 {
  font-size: 20px;
  letter-spacing: 0.12em;
  color: var(--text);
}

.sub {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-faint);
}

@media (max-width: 900px) {
  .auth-body {
    flex-direction: column;
    gap: 34px;
    padding: 40px 20px 56px;
    justify-content: flex-start;
  }
  .intro {
    text-align: center;
    max-width: 100%;
  }
  .headline br {
    display: none;
  }
  .lede br {
    display: none;
  }
  .card {
    width: min(420px, 100%);
  }
}
</style>
