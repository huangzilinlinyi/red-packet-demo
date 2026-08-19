const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin888";

let settings = {
  totalAmount: 188.00,
  totalCount: 40
};

function createPool() {
  return {
    totalAmount: settings.totalAmount,
    totalCount: settings.totalCount,
    remainingAmount: settings.totalAmount,
    remainingCount: settings.totalCount,
    claimedNames: new Set(),
    records: []
  };
}

let pool = createPool();

function round2(number) {
  return Math.round(Number(number) * 100) / 100;
}

function randomAmount() {
  if (pool.remainingCount <= 1) {
    return round2(pool.remainingAmount);
  }

  const average = pool.remainingAmount / pool.remainingCount;

  const min = Math.max(0.01, average * 0.35);
  const max = Math.min(
    pool.remainingAmount - 0.01 * (pool.remainingCount - 1),
    average * 1.85
  );

  let amount = min + Math.random() * Math.max(0, max - min);

  amount = Math.max(0.01, amount);
  amount = Math.min(
    amount,
    pool.remainingAmount - 0.01 * (pool.remainingCount - 1)
  );

  return round2(amount);
}

function publicState() {
  return {
    total: round2(pool.totalAmount),
    totalCount: pool.totalCount,
    remainingAmount: round2(pool.remainingAmount),
    remainingCount: pool.remainingCount,
    records: pool.records.map(item => ({
      name: item.name,
      amount: item.amount,
      time: item.time
    })),
    finished: pool.remainingCount <= 0
  };
}

/* 获取红包状态 */
app.get("/api/state", (req, res) => {
  res.json(publicState());
});

/* 抢红包 */
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
      message: "红包已经抢完了",
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

  pool.records.push({
    name,
    amount,
    time: new Date().toLocaleTimeString("zh-CN", {
      hour12: false
    })
  });

  res.json({
    ok: true,
    amount,
    state: publicState()
  });
});

/* 管理员：修改金额并重置活动 */
app.post("/api/admin/reset", (req, res) => {
  const password = String(req.body?.password || "");

  const totalAmount = Number(req.body?.totalAmount);
  const totalCount = Number(req.body?.totalCount);

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({
      ok: false,
      message: "管理员密码错误"
    });
  }

  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return res.status(400).json({
      ok: false,
      message: "红包总金额必须大于0"
    });
  }

  if (!Number.isInteger(totalCount) || totalCount <= 0) {
    return res.status(400).json({
      ok: false,
      message: "红包个数必须是正整数"
    });
  }

  if (totalAmount < totalCount * 0.01) {
    return res.status(400).json({
      ok: false,
      message: "总金额不足，每个红包至少需要0.01元"
    });
  }

  settings = {
    totalAmount: round2(totalAmount),
    totalCount
  };

  pool = createPool();

  res.json({
    ok: true,
    message: "活动已经重新开始",
    state: publicState()
  });
});

/* 管理员查看状态 */
app.get("/api/admin/state", (req, res) => {
  res.json(publicState());
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Red packet demo running on port ${PORT}`);
});
