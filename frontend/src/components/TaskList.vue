<script setup>
import { computed, ref } from 'vue';
import { useSessionStore } from '../stores/session.js';

const emit = defineEmits(['all-done']);
const session = useSessionStore();
const draft = ref('');
const editingId = ref('');
const editDraft = ref('');

/** v-focus 局部指令：进入编辑态自动聚焦并全选 */
const vFocus = {
  mounted(el) {
    el.focus();
    el.select();
  },
};

const progressText = computed(() =>
  session.tasksTotal ? `${session.tasksDone}/${session.tasksTotal}` : '还没有任务',
);

function add() {
  if (!session.addTask(draft.value)) return;
  draft.value = '';
  // 新增后若恰好全部完成，交给 store 的 allTasks 事件
}

function toggle(task) {
  const wasAll = session.allTasksDone;
  session.toggleTask(task.id);
  if (!wasAll && session.allTasksDone) emit('all-done');
}

function startEdit(task) {
  editingId.value = task.id;
  editDraft.value = task.title;
}

function commitEdit(task) {
  if (editingId.value !== task.id) return;
  session.renameTask(task.id, editDraft.value);
  editingId.value = '';
}

function cancelEdit() {
  editingId.value = '';
}
</script>

<template>
  <section class="tasks glass">
    <header class="tasks-head">
      <span class="panel-title">今日清单</span>
      <span class="count">{{ progressText }}</span>
    </header>

    <form class="add" @submit.prevent="add">
      <input v-model="draft" class="input" maxlength="100" placeholder="下一件要完成的事…" />
      <button class="btn btn-sm" type="submit" :disabled="!draft.trim()">添加</button>
    </form>

    <ul class="list" v-if="session.tasksTotal">
      <li v-for="task in session.tasks" :key="task.id" class="item" :class="{ done: task.done }">
        <button class="check" :class="{ on: task.done }" :aria-label="task.done ? '取消完成' : '标记完成'" @click="toggle(task)">
          <svg viewBox="0 0 16 16" v-if="task.done">
            <path d="M3 8.4l3.2 3.2L13 4.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <input
          v-if="editingId === task.id"
          v-model="editDraft"
          v-focus
          class="input edit-input"
          maxlength="100"
          aria-label="编辑任务"
          @keydown.enter.prevent="commitEdit(task)"
          @keydown.esc="cancelEdit"
          @blur="commitEdit(task)"
        />
        <span v-else class="title" title="双击编辑" @dblclick="startEdit(task)">{{ task.title }}</span>
        <button class="remove" aria-label="删除任务" @click="session.removeTask(task.id)">×</button>
      </li>
    </ul>

    <p v-else class="empty">先写下一件事，哪怕只是"翻开书"。</p>

    <footer v-if="session.tasksDone > 0" class="foot">
      <button class="btn-ghost btn btn-sm" @click="session.clearDone()">清除已完成</button>
    </footer>
  </section>
</template>

<style scoped>
.tasks {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tasks-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.count {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--accent);
}

.add {
  display: flex;
  gap: 8px;
  align-items: stretch;
}

.add .input {
  padding: 9px 12px;
  font-size: 13px;
}

.add button {
  white-space: nowrap;
  flex: 0 0 auto;
}


.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 240px;
  overflow-y: auto;
}

.item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 6px;
  border-radius: 8px;
  transition: background var(--transition);
}

.item:hover {
  background: rgba(255, 255, 255, 0.04);
}

.check {
  width: 17px;
  height: 17px;
  flex: 0 0 17px;
  border-radius: 5px;
  border: 1px solid var(--line-strong);
  display: grid;
  place-items: center;
  color: #0d1116;
  transition: all var(--transition);
}

.check.on {
  background: var(--accent);
  border-color: var(--accent);
}

.check svg {
  width: 12px;
  height: 12px;
}

.title {
  flex: 1;
  font-size: 13.5px;
  color: var(--text);
  transition: color var(--transition);
  word-break: break-all;
  cursor: text;
}

.edit-input {
  flex: 1;
  min-width: 0;
  padding: 4px 8px;
  font-size: 13px;
}

.item.done .title {
  color: var(--text-faint);
  text-decoration: line-through;
  text-decoration-color: rgba(255, 255, 255, 0.25);
}

.remove {
  opacity: 0;
  color: var(--text-faint);
  font-size: 16px;
  line-height: 1;
  padding: 0 4px;
  transition: opacity var(--transition), color var(--transition);
}

.item:hover .remove {
  opacity: 1;
}

.remove:hover {
  color: #ff9b9b;
}

.empty {
  font-size: 12.5px;
  color: var(--text-faint);
  padding: 6px 2px 2px;
}

.foot {
  display: flex;
  justify-content: flex-end;
}
</style>
