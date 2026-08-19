const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// 默认活动参数
let config = {
  totalAmount: 188,
  totalCount: 40
};

// 当前红包池
let pool = createPool();

function createPool() {
  return {
    total: config.totalAmount,
    remainingAmount: config.totalAmount,
    remainingCount: config.totalCount,
    records: [],
    claimedNames: new Set()
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function randomAmount() {
  if (pool.remainingCount <= 1) {
    return round2(pool.remainingAmount);
  }

  const avg = pool.remainingAmount / pool.remainingCount;

  const min = Math.max(0.01, avg * 0.35);
  const max = Math.max(min, avg * 1.85);

  let amount = min + Math.random() * (max - min);

  const reserve = 0.01 * (pool.remainingCount - 1);

  amount = Math.min(
    amount,
    pool.remainingAmount - reserve
  );

  return Math.max(0.01, round2(amount));
}

function publicState() {
  return {
    total: pool.total,
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

// 查看红包状态
app.get("/api/state", (req, res) => {
  res.json(publicState());
});

// 抢红包
app.post("/api/grab", (req, res) => {
  const name = String(req.body?.name || "").trim();

  if (!name) {
    return res.status(400).json({
      ok: false,
      message: "请输入姓名"
    });
  }

  if (name.length > 20) {
    return res.status(400).json({
      ok: false,
      message: "姓名不能超过20个字符"
    });
  }

  if (pool.remainingCount <= 0) {
    return res.status(409).json({
      ok: false,
      message: "红包已抢完",
      state: publicState()
    });
  }

  if (pool.claimedNames.has(name)) {
    return res.status(409).json({
      ok: false,
      message: "这个姓名已经抢过红包了",
      state: publicState()
    });
  }

  const amount = randomAmount();

  pool.remainingAmount = round2(
    pool.remainingAmount - amount
  );

  pool.remainingCount -= 1;

  pool.claimedNames.add(name);

  const record = {
    name,
    amount,
    time: new Date().toLocaleTimeString(
      "zh-CN",
      { hour12: false }
    )
  };

  pool.records.push(record);

  res.json({
    ok: true,
    amount,
    state: publicState()
  });
});

// 管理员重置活动
app.post("/api/admin/reset", (req, res) => {
  const totalAmount = Number(req.body?.totalAmount);
  const totalCount = Number(req.body?.totalCount);

  if (
    !Number.isFinite(totalAmount) ||
    totalAmount <= 0
  ) {
    return res.status(400).json({
      ok: false,
      message: "红包总金额必须大于0"
    });
  }

  if (
    !Number.isInteger(totalCount) ||
    totalCount <= 0
  ) {
    return res.status(400).json({
      ok: false,
      message: "红包个数必须是大于0的整数"
    });
  }

  if (totalAmount < totalCount * 0.01) {
    return res.status(400).json({
      ok: false,
      message: "总金额不足以保证每个红包至少0.01元"
    });
  }

  config.totalAmount = round2(totalAmount);
  config.totalCount = totalCount;

  pool = createPool();

  res.json({
    ok: true,
    message: "活动已重置",
    state: publicState()
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Red packet demo running at http://localhost:${PORT}`
  );
});
