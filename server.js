const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const TOTAL_AMOUNT = 188;
const TOTAL_COUNT = 40;

let pool = {
  total: TOTAL_AMOUNT,
  remainingAmount: TOTAL_AMOUNT,
  remainingCount: TOTAL_COUNT,
  records: [],
  claimedNames: new Set()
};

function round2(n) {
  return Math.round(n * 100) / 100;
}

function randomAmount() {
  if (pool.remainingCount <= 1) return round2(pool.remainingAmount);

  const avg = pool.remainingAmount / pool.remainingCount;
  const min = Math.max(0.01, avg * 0.35);
  const max = Math.max(min, avg * 1.85);

  let amount = min + Math.random() * (max - min);
  const reserve = 0.01 * (pool.remainingCount - 1);
  amount = Math.min(amount, pool.remainingAmount - reserve);

  return Math.max(0.01, round2(amount));
}

function publicState() {
  return {
    total: TOTAL_AMOUNT,
    remainingAmount: round2(pool.remainingAmount),
    remainingCount: pool.remainingCount,
    records: pool.records.map(r => ({
      name: r.name,
      amount: r.amount,
      time: r.time
    })),
    finished: pool.remainingCount <= 0
  };
}

app.get("/api/state", (req, res) => {
  res.json(publicState());
});

app.post("/api/grab", (req, res) => {
  const name = String(req.body?.name || "").trim();

  if (!name) {
    return res.status(400).json({ ok: false, message: "请输入姓名" });
  }
  if (name.length > 20) {
    return res.status(400).json({ ok: false, message: "姓名不能超过20个字符" });
  }

  if (pool.remainingCount <= 0) {
    return res.status(409).json({ ok: false, message: "红包已抢完", state: publicState() });
  }

  if (pool.claimedNames.has(name)) {
    return res.status(409).json({ ok: false, message: "这个姓名已经抢过红包了", state: publicState() });
  }

  // Node 的请求处理在此同步区间内完成，单个进程不会出现两个请求同时修改红包池。
  const amount = randomAmount();

  pool.remainingAmount = round2(pool.remainingAmount - amount);
  pool.remainingCount -= 1;
  pool.claimedNames.add(name);

  const record = {
    name,
    amount,
    time: new Date().toLocaleTimeString("zh-CN", { hour12: false })
  };
  pool.records.push(record);

  res.json({
    ok: true,
    amount,
    state: publicState()
  });
});

app.post("/api/reset-disabled", (req, res) => {
  // 演示管理接口：不接支付，仅用于部署者测试时清空并恢复活动。
  pool = {
    total: TOTAL_AMOUNT,
    remainingAmount: TOTAL_AMOUNT,
    remainingCount: TOTAL_COUNT,
    records: [],
    claimedNames: new Set()
  };
  res.json({ ok: true, state: publicState() });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Red packet demo running at http://localhost:${PORT}`);
});
