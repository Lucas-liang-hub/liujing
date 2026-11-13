import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

/* ── mock API 层：捕获 updateProfile 实际提交的载荷 ───────── */
const updateProfileMock = vi.fn(async (payload) => ({
  user: { id: 1, username: 'yyy', nickname: payload.nickname ?? '大王', prefs: payload.prefs ?? {} },
}));

vi.mock('../src/api/index.js', () => ({
  authApi: {
    profile: vi.fn(async () => ({ user: { id: 1, username: 'yyy', nickname: '大王', prefs: {} } })),
    updateProfile: (...args) => updateProfileMock(...args),
  },
  sessionApi: {},
  statsApi: {},
  aiApi: {
    config: vi.fn(async () => ({ greeting: '' })),
    getLlm: vi.fn(async () => ({ configured: false, source: 'env' })),
    setLlm: vi.fn(async () => ({ configured: true })),
    clearLlm: vi.fn(async () => ({ configured: false })),
    testLlm: vi.fn(async () => ({ ok: true, reply: 'ok' })),
    chat: vi.fn(async () => ({})),
    streamChat: vi.fn(),
  },
}));

/* ── mock 重依赖子组件与路由 ───────── */
vi.mock('../src/components/AppHeader.vue', () => ({ default: { template: '<header/>' } }));
vi.mock('../src/scenes/index.js', () => ({
  SCENE_META: [{ id: 'sakura', name: '樱吹雪', accent: '#f8a5c2' }],
  SCENE_IDS: ['sakura'],
  getSceneMeta: (id) => ({ id, accent: '#f8a5c2' }),
}));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import Settings from '../src/views/Settings.vue';
import { useUserStore } from '../src/stores/user.js';

async function mountSettings() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const wrapper = mount(Settings, { global: { plugins: [pinia] } });
  await flushPromises();
  return wrapper;
}

describe('设置页 · 昵称保存', () => {
  beforeEach(() => {
    updateProfileMock.mockClear();
    localStorage.clear();
  });

  it('修改昵称时提交新昵称', async () => {
    const wrapper = await mountSettings();
    const input = wrapper.find('input.input');
    await input.setValue('新名字');
    await wrapper.findAll('.actions .btn')[0].trigger('click');
    await flushPromises();

    expect(updateProfileMock).toHaveBeenCalledTimes(1);
    const payload = updateProfileMock.mock.calls[0][0];
    expect(payload.nickname).toBe('新名字');
  });

  it('清空昵称时必须提交空字符串，而不是把字段丢弃（回归：清空后保存不上）', async () => {
    const wrapper = await mountSettings();
    const input = wrapper.find('input.input');
    await input.setValue('');
    await wrapper.findAll('.actions .btn')[0].trigger('click');
    await flushPromises();

    expect(updateProfileMock).toHaveBeenCalledTimes(1);
    const payload = updateProfileMock.mock.calls[0][0];
    expect(payload.nickname).toBe('');
  });

  it('保存成功后昵称写回用户 store，清空时展示层回退为用户名', async () => {
    const wrapper = await mountSettings();
    const input = wrapper.find('input.input');
    await input.setValue('');
    await wrapper.findAll('.actions .btn')[0].trigger('click');
    await flushPromises();

    const user = useUserStore();
    expect(user.user.nickname).toBe('');
    expect(user.nickname).toBe('yyy'); // computed 兜底：空昵称回退用户名
  });
});
