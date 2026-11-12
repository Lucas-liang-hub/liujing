import { describe, expect, it } from 'vitest';
import { clamp, density, rand } from '../src/scenes/engine.js';

describe('engine 纯函数（技术方案 §6：引擎逻辑与绘制解耦）', () => {
  it('rand 生成开区间内随机数', () => {
    for (let i = 0; i < 200; i += 1) {
      const v = rand(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThan(7);
    }
  });

  it('rand 单点区间返回下界', () => {
    expect(rand(5, 5)).toBe(5);
  });

  it('clamp 收敛越界值', () => {
    expect(clamp(9, 0, 5)).toBe(5);
    expect(clamp(-3, 0, 5)).toBe(0);
    expect(clamp(2, 0, 5)).toBe(2);
  });

  it('density 随画布面积计算并夹在上下限之间', () => {
    expect(density(700, 700, 5, 120)).toBe(35); // 490000/14000
    expect(density(10000, 10000, 5, 120)).toBe(120); // 714… → 触顶
    expect(density(200, 200, 5, 120)).toBe(5); // ≈2.9 → 触底
  });
});
