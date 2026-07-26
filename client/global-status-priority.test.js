import assert from 'node:assert/strict';
import {
  GLOBAL_STATUS_CHANNELS,
  GLOBAL_STATUS_PRIORITY,
  createGlobalStatusArbiter,
} from './src/global-status-priority.js';

let clock = 1000;
let timerId = 0;
const timers = new Map();
const renders = [];
let clears = 0;
const arbiter = createGlobalStatusArbiter({
  render: (view, entry) => renders.push({ text: view.text, channel: entry.channel }),
  clear: () => { clears += 1; },
  now: () => clock,
  setTimer: (fn, delay) => {
    const id = ++timerId;
    timers.set(id, { fn, at: clock + delay });
    return id;
  },
  clearTimer: (id) => timers.delete(id),
});

function advance(ms) {
  clock += ms;
  const due = [...timers.entries()]
    .filter(([, timer]) => timer.at <= clock)
    .sort((a, b) => a[1].at - b[1].at);
  for (const [id, timer] of due) {
    if (!timers.delete(id)) continue;
    timer.fn();
  }
}

arbiter.publish(GLOBAL_STATUS_CHANNELS.RECOVERY, { text: '正在恢复' }, {
  priority: GLOBAL_STATUS_PRIORITY.RECOVERY_PENDING,
});
assert.equal(arbiter.getActive().channel, GLOBAL_STATUS_CHANNELS.RECOVERY);

arbiter.publish(GLOBAL_STATUS_CHANNELS.CONNECTION, { text: '网络已断开' }, {
  priority: GLOBAL_STATUS_PRIORITY.CONNECTION_FAILURE,
});
assert.equal(arbiter.getActive().channel, GLOBAL_STATUS_CHANNELS.CONNECTION, '断网必须覆盖恢复提示');

arbiter.dismiss(GLOBAL_STATUS_CHANNELS.CONNECTION);
assert.equal(arbiter.getActive().channel, GLOBAL_STATUS_CHANNELS.RECOVERY, '网络恢复后应重新显示仍在进行的恢复状态');

arbiter.publish(GLOBAL_STATUS_CHANNELS.RECOVERY, { text: '恢复成功' }, {
  priority: GLOBAL_STATUS_PRIORITY.RECOVERY_RESULT,
  duration: 4200,
});
arbiter.publish(GLOBAL_STATUS_CHANNELS.CONNECTION, { text: '再次断网' }, {
  priority: GLOBAL_STATUS_PRIORITY.CONNECTION_FAILURE,
});
advance(4200);
assert.equal(arbiter.getActive().channel, GLOBAL_STATUS_CHANNELS.CONNECTION, '旧恢复计时器不能删除较新的断网提示');

arbiter.publish(GLOBAL_STATUS_CHANNELS.SERVER_ERROR, null, {
  priority: GLOBAL_STATUS_PRIORITY.SERVER_ERROR,
  duration: 3800,
  visible: false,
});
assert.equal(arbiter.getActive().channel, GLOBAL_STATUS_CHANNELS.SERVER_ERROR, '服务端错误应暂时压住底部普通状态');
assert.ok(clears > 0, '服务端错误显示时应清除底部重复播报');
advance(3800);
assert.equal(arbiter.getActive().channel, GLOBAL_STATUS_CHANNELS.CONNECTION, '服务端错误消失后应恢复仍有效的断网状态');

arbiter.dismiss(GLOBAL_STATUS_CHANNELS.CONNECTION);
assert.equal(arbiter.getActive(), null, '所有状态结束后不应残留提示');
assert.ok(renders.some((item) => item.text === '网络已断开'));
console.log('global status priority tests passed');
