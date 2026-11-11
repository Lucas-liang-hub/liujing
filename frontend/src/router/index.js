import { createRouter, createWebHistory } from 'vue-router';
import { getToken } from '../api/client.js';

const routes = [
  { path: '/', name: 'study', component: () => import('../views/StudyRoom.vue'), meta: { auth: true } },
  { path: '/stats', name: 'stats', component: () => import('../views/Stats.vue'), meta: { auth: true } },
  { path: '/settings', name: 'settings', component: () => import('../views/Settings.vue'), meta: { auth: true } },
  { path: '/login', name: 'login', component: () => import('../views/Login.vue'), meta: { guest: true } },
  { path: '/register', name: 'register', component: () => import('../views/Register.vue'), meta: { guest: true } },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach((to) => {
  const authed = Boolean(getToken());
  if (to.meta.auth && !authed) {
    return { name: 'login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } };
  }
  if (to.meta.guest && authed) return { name: 'study' };
  return true;
});

export default router;
