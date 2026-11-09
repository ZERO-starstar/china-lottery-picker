import { useState } from "react";
import {
  calculateStatistics,
  formatAllNumbers,
  formatSingleTicket,
  generateSecureBatch,
  lotteryMeta,
  MAX_TICKET_COUNT,
  MIN_TICKET_COUNT,
  type LotteryType,
  type QlcTicket,
  type SsqTicket,
  type Ticket,
} from "./lib/lottery";

const pad = (number: number) => String(number).padStart(2, "0");

const formatTime = (date: Date) =>
  new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);

async function writeToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) {
    throw new Error("当前浏览器无法复制，请手动选择号码。");
  }
}

function Ball({
  number,
  tone,
}: {
  number: number;
  tone: "red" | "blue" | "orange";
}) {
  return (
    <span className={`number-ball number-ball--${tone}`}>{pad(number)}</span>
  );
}

function TicketNumbers({
  type,
  ticket,
}: {
  type: LotteryType;
  ticket: Ticket;
}) {
  if (type === "ssq" && ticket.type === "ssq") {
    return (
      <div className="ticket-numbers" aria-label="双色球号码">
        <div className="ball-group">
          {ticket.red.map((number) => (
            <Ball key={number} number={number} tone="red" />
          ))}
        </div>
        <span className="plus-sign" aria-label="加号">
          +
        </span>
        <Ball number={ticket.blue} tone="blue" />
      </div>
    );
  }

  if (type === "qlc" && ticket.type === "qlc") {
    return (
      <div className="ticket-numbers ball-group" aria-label="七乐彩号码">
        {ticket.numbers.map((number) => (
          <Ball key={number} number={number} tone="orange" />
        ))}
      </div>
    );
  }

  return null;
}

function EmptyNumbers({
  type,
  requestedCount,
}: {
  type: LotteryType;
  requestedCount: number;
}) {
  return (
    <div className="empty-numbers" aria-label="尚未生成号码">
      <div className="empty-ball-art" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div>
        <strong>随机组合，等待揭晓</strong>
        <p>
          点击上方按钮，生成 {requestedCount} 注互不重复的
          {lotteryMeta[type].name}号码。
        </p>
      </div>
      <div className="empty-dashes" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
    </div>
  );
}

function NumberSheet({
  type,
  tickets,
  generatedAt,
  requestedCount,
  onCopy,
  onCopyAll,
}: {
  type: LotteryType;
  tickets: Ticket[];
  generatedAt: Date | null;
  requestedCount: number;
  onCopy: (ticket: Ticket, index: number) => void;
  onCopyAll: () => void;
}) {
  const meta = lotteryMeta[type];
  const hasNumbers = tickets.length > 0;

  return (
    <section className="number-sheet" aria-labelledby="number-sheet-title">
      <div className="ticket-tape" aria-hidden="true" />
      <div className="sheet-heading">
        <div>
          <p className="section-kicker">本次随机组合</p>
          <h2 id="number-sheet-title">
            你的{meta.name}号码
          </h2>
        </div>
        <button
          className="copy-all-button"
          type="button"
          onClick={onCopyAll}
          disabled={!hasNumbers}
        >
          <CopyIcon />
          复制全部{requestedCount}注
        </button>
      </div>

      <div className="sheet-meta">
        <span>
          <i className={`status-dot status-dot--${type}`} aria-hidden="true" />
          {meta.name}
        </span>
        <span>本次生成：{tickets.length}注</span>
        <time dateTime={generatedAt?.toISOString()}>
          {generatedAt ? formatTime(generatedAt) : "尚未生成"}
        </time>
      </div>

      {hasNumbers ? (
        <ol
          className="tickets-list"
          aria-label={`${meta.name}${tickets.length}注号码`}
        >
          {tickets.map((ticket, index) => (
            <li
              className="ticket-row"
              key={`${type}-${index}-${formatSingleTicket(type, ticket, index + 1)}`}
            >
              <span className="ticket-index">第{index + 1}注</span>
              <TicketNumbers type={type} ticket={ticket} />
              <button
                className="copy-ticket-button"
                type="button"
                onClick={() => onCopy(ticket, index)}
                aria-label={`复制第${index + 1}注`}
              >
                <CopyIcon />
                <span>复制</span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyNumbers type={type} requestedCount={requestedCount} />
      )}

      <p className="ticket-footnote">
        <LockIcon />
        号码仅在当前浏览器中生成，刷新页面后不会保留。
      </p>
    </section>
  );
}

function Statistics({
  type,
  tickets,
  requestedCount,
}: {
  type: LotteryType;
  tickets: Ticket[];
  requestedCount: number;
}) {
  const meta = lotteryMeta[type];
  const hasNumbers = tickets.length > 0;
  const stats = hasNumbers ? calculateStatistics(type, tickets) : null;
  const value = (content: string | number | null | undefined) =>
    stats && content !== null && content !== undefined ? content : "—";

  return (
    <section className="content-section stats-section" aria-labelledby="stats-title">
      <div className="section-heading">
        <div>
          <p className="section-kicker">组合分布</p>
          <h2 id="stats-title">{meta.name}号码统计</h2>
        </div>
        <p className="section-note">数据仅描述本次组合，不代表中奖概率提升</p>
      </div>

      <div className={`stats-grid stats-grid--${type}`}>
        <div className="stat-cell stat-cell--accent">
          <span>{type === "ssq" ? "红球总出现次数" : "号码总出现次数"}</span>
          <strong>{value(stats?.totalPicks ? `${stats.totalPicks} 次` : null)}</strong>
          <small>
            {requestedCount}注 × {type === "ssq" ? "6" : "7"} 个号码
          </small>
        </div>
        <div className="stat-cell">
          <span>不同号码数量</span>
          <strong>{value(stats?.differentNumbers)}</strong>
          <small>号码池中出现的唯一值</small>
        </div>
        <div className="stat-cell">
          <span>号码覆盖率</span>
          <strong>{value(stats?.coverage)}</strong>
          <small>对应 {type === "ssq" ? "33" : "30"} 个号码</small>
        </div>
        <div className="stat-cell">
          <span>跨注重复情况</span>
          <strong>
            {stats ? `${stats.primaryRepeatedNumbers} 个` : "—"}
          </strong>
          <small>
            {stats ? `额外出现 ${stats.primaryRepeatExcess} 次` : "同一号码可在多注出现"}
          </small>
        </div>

        {type === "ssq" && (
          <>
            <div className="stat-cell">
              <span>蓝球总出现次数</span>
              <strong>
                {value(
                  stats?.secondaryTotalPicks
                    ? `${stats.secondaryTotalPicks} 次`
                    : null,
                )}
              </strong>
              <small>{requestedCount}注 × 1 个蓝球</small>
            </div>
            <div className="stat-cell">
              <span>不同蓝球数量</span>
              <strong>{value(stats?.secondaryDifferentNumbers)}</strong>
              <small>号码池中出现的唯一值</small>
            </div>
            <div className="stat-cell">
              <span>蓝球覆盖率</span>
              <strong>{value(stats?.secondaryCoverage)}</strong>
              <small>对应 16 个蓝球</small>
            </div>
            <div className="stat-cell">
              <span>蓝球跨注重复</span>
              <strong>
                {stats ? `${stats.secondaryRepeatedNumbers} 个` : "—"}
              </strong>
              <small>
                {stats ? `额外出现 ${stats.secondaryRepeatExcess} 次` : "蓝球可跨注重复"}
              </small>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function RulesAndProbability({
  type,
  ticketCount,
}: {
  type: LotteryType;
  ticketCount: number;
}) {
  const meta = lotteryMeta[type];
  const isSsq = type === "ssq";

  return (
    <section className="content-section odds-section" aria-labelledby="odds-title">
      <div className="section-heading">
        <div>
          <p className="section-kicker">规则与机会</p>
          <h2 id="odds-title">{meta.name}中奖概率</h2>
        </div>
        <p className="section-note">理论数学概率，不来自历史数据或预测模型</p>
      </div>

      <div className="odds-layout">
        <div className="rule-copy">
          <p className="rule-lead">{meta.rule}</p>
          <dl>
            <div>
              <dt>彩票种类</dt>
              <dd>{meta.name}</dd>
            </div>
            <div>
              <dt>一等奖条件</dt>
              <dd>
                {isSsq
                  ? "6 个红球和 1 个蓝球全部命中"
                  : "7 个基本号码全部命中"}
              </dd>
            </div>
            {!isSsq && (
              <div>
                <dt>特别号码</dt>
                <dd>特别号码不参与选号</dd>
              </div>
            )}
          </dl>
          <p className="rule-detail">
            {isSsq
              ? `红球与蓝球、以及不同注之间可以正常重复；整注完整组合在本次${ticketCount}注中保持唯一。`
              : "特别号码由开奖过程产生，投注时只需选择 7 个基本号码，不需要第 8 个号码。"}
          </p>
        </div>

        <div className="probability-card">
          <div className="probability-block">
            <span>单注一等奖理论概率</span>
            <strong data-probability>{meta.probability}</strong>
          </div>
          <div className="probability-divider" aria-hidden="true" />
          <div className="probability-block">
            <span>购买{ticketCount}注互不重复组合</span>
            <strong data-probability>
              {ticketCount} / {isSsq ? "17,721,088" : "2,035,800"}
            </strong>
          </div>
        </div>
      </div>
    </section>
  );
}

function IconBase({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function CopyIcon() {
  return (
    <IconBase>
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </IconBase>
  );
}

function LockIcon() {
  return (
    <IconBase className="inline-icon">
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </IconBase>
  );
}

function DiceIcon() {
  return (
    <IconBase className="button-icon">
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <circle cx="9" cy="9" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="9" r="1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="15" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="15" r="1" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

function App() {
  const [selectedLottery, setSelectedLottery] = useState<LotteryType>("ssq");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [notice, setNotice] = useState("");
  const [ticketCount, setTicketCount] = useState(5);
  const [ticketCountInput, setTicketCountInput] = useState("5");
  const meta = lotteryMeta[selectedLottery];
  const parsedTicketCount = Number(ticketCountInput);
  const isTicketCountValid =
    Number.isInteger(parsedTicketCount) &&
    parsedTicketCount >= MIN_TICKET_COUNT &&
    parsedTicketCount <= MAX_TICKET_COUNT;

  const handleLotteryChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextType = event.target.value as LotteryType;
    setSelectedLottery(nextType);
    setTickets([]);
    setGeneratedAt(null);
    setNotice(`已切换至${lotteryMeta[nextType].name}，请重新生成号码。`);
  };

  const handleGenerate = () => {
    if (!isTicketCountValid) {
      setNotice(
        `请输入 ${MIN_TICKET_COUNT}–${MAX_TICKET_COUNT} 之间的整数注数。`,
      );
      return;
    }

    setNotice("");
    try {
      const nextTickets = generateSecureBatch(selectedLottery, ticketCount);
      setTickets(nextTickets);
      setGeneratedAt(new Date());
      setNotice(`已生成${ticketCount}注${meta.name}号码。`);
    } catch (error) {
      setTickets([]);
      setGeneratedAt(null);
      setNotice(error instanceof Error ? error.message : "号码生成失败，请重试。");
    }
  };

  const handleTicketCountChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const nextInput = event.target.value;
    const nextCount = Number(nextInput);

    setTicketCountInput(nextInput);
    setTickets([]);
    setGeneratedAt(null);
    setNotice("");

    if (
      Number.isInteger(nextCount) &&
      nextCount >= MIN_TICKET_COUNT &&
      nextCount <= MAX_TICKET_COUNT
    ) {
      setTicketCount(nextCount);
    }
  };

  const handleCopy = async (ticket: Ticket, index: number) => {
    try {
      await writeToClipboard(
        formatSingleTicket(selectedLottery, ticket, index + 1),
      );
      setNotice(`第${index + 1}注${meta.name}号码已复制。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "复制失败，请重试。");
    }
  };

  const handleCopyAll = async () => {
    if (tickets.length === 0) return;

    try {
      await writeToClipboard(formatAllNumbers(selectedLottery, tickets));
      setNotice(`全部${tickets.length}注${meta.name}号码已复制。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "复制失败，请重试。");
    }
  };

  return (
    <div className="app-shell" data-lottery={selectedLottery}>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="返回页面顶部">
          <span className="brand-mark" aria-hidden="true">
            选
          </span>
          <span>
            <strong>福彩随机选号</strong>
            <small>本地生成 · 组合去重</small>
          </span>
        </a>
        <span className="header-seal" aria-hidden="true">
          理性购彩
        </span>
      </header>

      <main id="top">
        <section className={`hero hero--${selectedLottery}`} aria-labelledby="main-title">
          <div className="hero-copy">
            <p className="hero-label">中国福利彩票</p>
            <h1 id="main-title">中国福利彩票智能选号工具</h1>
            <p className="hero-subtitle">双色球 · 七乐彩 · 随机组合生成器</p>
            <p className="hero-description">
              用浏览器的密码学安全随机数，生成合法、互不重复的随机组合。
              不预测结果，只认真完成一次随机选择。
            </p>
          </div>

          <div className="selector-panel">
            <div className="selector-fields">
              <div className="selector-field">
                <label htmlFor="lottery-select">选择彩票种类</label>
                <div className="select-wrap">
                  <select
                    id="lottery-select"
                    value={selectedLottery}
                    onChange={handleLotteryChange}
                  >
                    <option value="ssq">双色球</option>
                    <option value="qlc">七乐彩</option>
                  </select>
                  <span className="select-arrow" aria-hidden="true" />
                </div>
              </div>
              <div className="selector-field selector-field--count">
                <label htmlFor="ticket-count">生成注数</label>
                <div className="count-input-wrap">
                  <input
                    id="ticket-count"
                    type="number"
                    inputMode="numeric"
                    min={MIN_TICKET_COUNT}
                    max={MAX_TICKET_COUNT}
                    step="1"
                    value={ticketCountInput}
                    onChange={handleTicketCountChange}
                    aria-invalid={!isTicketCountValid}
                    aria-describedby="ticket-count-help"
                  />
                  <span aria-hidden="true">注</span>
                </div>
                <small id="ticket-count-help">
                  {MIN_TICKET_COUNT}–{MAX_TICKET_COUNT} 注
                </small>
              </div>
            </div>
            <p>
              <span className="signal-dot" aria-hidden="true" />
              当前玩法：{meta.name}
            </p>
          </div>
        </section>

        <section className="lottery-stage" aria-labelledby="stage-title">
          <div className="ticket-notch ticket-notch--top" aria-hidden="true" />
          <div className="ticket-notch ticket-notch--bottom" aria-hidden="true" />

          <div className="stage-topline">
            <span>当前玩法</span>
            <span>
              {meta.shortName} / {ticketCount} 注
            </span>
          </div>

          <div className="stage-controls">
            <div className="stage-copy">
              <div className="stage-title-row">
                <span className={`lottery-symbol lottery-symbol--${selectedLottery}`}>
                  {selectedLottery === "ssq" ? "双" : "七"}
                </span>
                <h2 id="stage-title">{meta.name}</h2>
              </div>
              <p>{meta.rule}</p>
              <div className="rule-pills" aria-label="选号规则">
                {selectedLottery === "ssq" ? (
                  <>
                    <span>红球 01—33 选 6</span>
                    <span>蓝球 01—16 选 1</span>
                  </>
                ) : (
                  <span>基本号码 01—30 选 7</span>
                )}
                <span>整注不重复</span>
              </div>
            </div>

            <div className="generate-area">
              <button
                className="generate-button"
                type="button"
                onClick={handleGenerate}
                disabled={!isTicketCountValid}
              >
                <DiceIcon />
                <span>生成{ticketCount}注号码</span>
              </button>
              <small>当前设置：{ticketCount} 注，点击即可重新生成</small>
            </div>
          </div>

          <div className="stage-rule" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>

          <NumberSheet
            type={selectedLottery}
            tickets={tickets}
            generatedAt={generatedAt}
            requestedCount={ticketCount}
            onCopy={handleCopy}
            onCopyAll={handleCopyAll}
          />
        </section>

        <div className="live-region" role="status" aria-live="polite">
          {notice}
        </div>

        <Statistics
          type={selectedLottery}
          tickets={tickets}
          requestedCount={ticketCount}
        />
        <RulesAndProbability
          type={selectedLottery}
          ticketCount={ticketCount}
        />

        <section className="method-section" aria-labelledby="method-title">
          <div className="section-heading">
            <div>
              <p className="section-kicker">透明说明</p>
              <h2 id="method-title">随机、隐私与理性购彩</h2>
            </div>
          </div>
          <div className="method-grid">
            <article>
              <span className="method-number">01</span>
              <h3>密码学安全随机</h3>
              <p>
                使用浏览器原生 crypto.getRandomValues()，通过拒绝采样消除取模偏差，
                再执行无偏 Fisher–Yates 抽样。
              </p>
            </article>
            <article>
              <span className="method-number">02</span>
              <h3>只做合法去重</h3>
              <p>
                不限制奇偶、连号、和值或冷热号码。每一注只校验范围、数量和整注唯一性，
                让所有合法组合保持同等机会。
              </p>
            </article>
            <article>
              <span className="method-number">03</span>
              <h3>号码不出浏览器</h3>
              <p>
                无账号、无数据库、无追踪、无第三方 AI 接口。号码不会上传，
                刷新页面后即被清除。
              </p>
            </article>
          </div>
          <p className="rational-note">
            彩票开奖具有随机性，任何算法都不能预测下一期号码。请量力而行，
            未满 18 周岁不得购买彩票。
          </p>
        </section>
      </main>

      <footer>
        <div>
          <strong>中国福利彩票智能选号工具</strong>
          <p>随机数仅用于号码组合，不构成购彩建议。</p>
        </div>
        <p>公益为本 · 理性购彩 · 量力而行</p>
      </footer>
    </div>
  );
}

export default App;
