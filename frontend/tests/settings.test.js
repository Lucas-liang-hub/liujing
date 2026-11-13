import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

/* ── mock API 层：捕获 updateProfile / aiApi 实际提交的载荷 ───────── */
const updateProfileMock = vi.fn(async (payload) => ({
  user: { id: 1, username: 'yyy', nickname: payload.nickname ?? '大王', prefs: payload.prefs ?? {} },
}));
const getLlmMock = vi.fn(async () => ({ configured: false, source: 'env', baseUrl: '', model: '' }));
const setLlmMock = vi.fn(async (payload) => ({
  configured: true,
  source: 'runtime',
  baseUrl: payload.baseUrl || 'https://api.deepseek.com/v1',
  model: payload.model || 'deepseek-chat',
  keyMasked: 'sk-abc****wxyz',
}));
const testLlmMock = vi.fn(async () => ({ ok: true, reply: '连接正常', tested: { model: 'deepseek-chat' } }));

vi.mock('../src/api/index.js', () => ({
  authApi: {
    profile: vi.fn(async () => ({ user: { id: 1, username: 'yyy', nickname: '大王', prefs: {} } })),
    updateProfile: (...args) => updateProfileMock(...args),
  },
  sessionApi: {},
  statsApi: {},
  aiApi: {
    config: vi.fn(async () => ({ greeting: '' })),
    getLlm: (...args) => getLlmMock(...args),
    setLlm: (...args) => setLlmMock(...args),
    clearLlm: vi.fn(async () => ({ configured: false, source: 'env', baseUrl: '', model: '' })),
    testLlm: (...args) => testLlmMock(...args),
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
  localStorage.setItem('liujing_token', 'test-token'); // 让 fetchProfile 真正拉取画像
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

  it('在昵称框按回车即可保存（不必滚到底部点按钮）', async () => {
    const wrapper = await mountSettings();
    const input = wrapper.find('input.input');
    await input.setValue('回车改名');
    await input.trigger('keyup.enter');
    await flushPromises();

    expect(updateProfileMock).toHaveBeenCalledTimes(1);
    expect(updateProfileMock.mock.calls[0][0].nickname).toBe('回车改名');
  });

  it('改动后提示未保存，保存后提示已保存', async () => {
    const wrapper = await mountSettings();
    const input = wrapper.find('input.input');

    await input.setValue('改了一半');
    expect(wrapper.find('.field-note').text()).toContain('未保存');

    await input.trigger('keyup.enter');
    await flushPromises();
    expect(wrapper.find('.field-note').text()).toContain('已');
    expect(wrapper.find('.field-note').text()).not.toContain('未保存');
  });
});

describe('设置页 · 月见大模型配置', () => {
  const llmInputs = (wrapper) => wrapper.findAll('.llm-grid .input');
  const llmBtn = (wrapper, i) => wrapper.findAll('.llm-actions .btn')[i];

  beforeEach(() => {
    setLlmMock.mockClear();
    testLlmMock.mockClear();
    getLlmMock.mockClear();
    localStorage.clear();
  });

  it('已配置过 Key 时，留空也能只改模型/地址', async () => {
    getLlmMock.mockResolvedValue({ configured: true, source: 'env', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' });
    const wrapper = await mountSettings();
    await llmInputs(wrapper)[2].setValue('deepseek-reasoner');
    await llmBtn(wrapper, 0).trigger('click');
    await flushPromises();

    expect(setLlmMock).toHaveBeenCalledTimes(1);
    const payload = setLlmMock.mock.calls[0][0];
    expect(payload.apiKey).toBe('');
    expect(payload.model).toBe('deepseek-reasoner');
  });

  it('未配置且 Key 为空时给出提示，不发请求', async () => {
    getLlmMock.mockResolvedValue({ configured: false, source: 'env', baseUrl: '', model: '' });
    const wrapper = await mountSettings();
    await llmBtn(wrapper, 0).trigger('click');
    await flushPromises();

    expect(setLlmMock).not.toHaveBeenCalled();
    expect(wrapper.find('.llm-actions .hint').text()).toContain('请填写 API Key');
  });

  it('测试连接提交的是输入框里尚未保存的配置', async () => {
    getLlmMock.mockResolvedValue({ configured: false, source: 'env', baseUrl: '', model: '' });
    const wrapper = await mountSettings();
    const [key, baseUrl, model] = llmInputs(wrapper);
    await key.setValue('sk-typed-but-unsaved');
    await baseUrl.setValue('https://dashscope.aliyuncs.com/compatible-mode/v1');
    await model.setValue('qwen-plus');
    await llmBtn(wrapper, 1).trigger('click');
    await flushPromises();

    expect(testLlmMock).toHaveBeenCalledTimes(1);
    expect(testLlmMock.mock.calls[0][0]).toEqual({
      apiKey: 'sk-typed-but-unsaved',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: 'qwen-plus',
    });
    expect(wrapper.find('.llm-actions .hint').text()).toContain('连接正常');
  });
});
