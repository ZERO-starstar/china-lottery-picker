export type LotteryType = "ssq" | "qlc";

export type SsqTicket = {
  type: "ssq";
  red: number[];
  blue: number;
};

export type QlcTicket = {
  type: "qlc";
  numbers: number[];
};

export type Ticket = SsqTicket | QlcTicket;

export type RandomSource = {
  nextUint32: () => number;
};

export type LotteryStatistics = {
  totalPicks: number;
  differentNumbers: number;
  coverage: string;
  primaryRepeatedNumbers: number;
  primaryRepeatExcess: number;
  secondaryTotalPicks: number | null;
  secondaryDifferentNumbers: number | null;
  secondaryCoverage: string | null;
  secondaryRepeatedNumbers: number | null;
  secondaryRepeatExcess: number | null;
};

export const MIN_TICKET_COUNT = 1;
export const MAX_TICKET_COUNT = 100;

type CryptoLike = {
  getRandomValues: <T extends ArrayBufferView>(array: T) => T;
};

export const lotteryMeta = {
  ssq: {
    name: "双色球",
    shortName: "SSQ",
    rangeLabel: "红球 01–33 · 蓝球 01–16",
    rule: "33 选 6 个红球，16 选 1 个蓝球",
    probability: "1 / 17,721,088",
  },
  qlc: {
    name: "七乐彩",
    shortName: "QLC",
    rangeLabel: "基本号码 01–30",
    rule: "30 选 7 个基本号码",
    probability: "1 / 2,035,800",
  },
} as const;

export function createSecureRandomSource(
  cryptoProvider: CryptoLike = globalThis.crypto,
): RandomSource {
  if (!cryptoProvider?.getRandomValues) {
    throw new Error("浏览器不支持安全随机数，请更换现代浏览器后重试。");
  }

  return {
    nextUint32() {
      const values = new Uint32Array(1);
      cryptoProvider.getRandomValues(values);
      return values[0];
    },
  };
}

export function randomInt(
  maxExclusive: number,
  source: RandomSource,
): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error("随机范围必须是正整数。");
  }

  const uint32Range = 0x1_0000_0000;
  const limit = uint32Range - (uint32Range % maxExclusive);
  let value = source.nextUint32();

  while (value >= limit) {
    value = source.nextUint32();
  }

  return value % maxExclusive;
}

export function sampleUnique(
  poolSize: number,
  count: number,
  source: RandomSource,
): number[] {
  if (
    !Number.isInteger(poolSize) ||
    !Number.isInteger(count) ||
    poolSize <= 0 ||
    count < 0 ||
    count > poolSize
  ) {
    throw new Error("抽样数量必须位于合法范围内。");
  }

  const pool = Array.from({ length: poolSize }, (_, index) => index + 1);
  for (let index = 0; index < count; index += 1) {
    const swapIndex = index + randomInt(poolSize - index, source);
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }

  return pool.slice(0, count).sort((left, right) => left - right);
}

function drawSsq(source: RandomSource): SsqTicket {
  return {
    type: "ssq",
    red: sampleUnique(33, 6, source),
    blue: sampleUnique(16, 1, source)[0],
  };
}

function drawQlc(source: RandomSource): QlcTicket {
  return {
    type: "qlc",
    numbers: sampleUnique(30, 7, source),
  };
}

export function ticketKey(ticket: Ticket): string {
  return ticket.type === "ssq"
    ? `${ticket.red.join(",")}+${ticket.blue}`
    : ticket.numbers.join(",");
}

export function generateTickets<T extends Ticket>(
  draw: () => T,
  count: number,
  maxAttempts = Math.max(10_000, count * 100),
): T[] {
  if (
    !Number.isInteger(count) ||
    count < MIN_TICKET_COUNT ||
    count > MAX_TICKET_COUNT
  ) {
    throw new Error(
      `生成注数必须是 ${MIN_TICKET_COUNT}–${MAX_TICKET_COUNT} 之间的整数。`,
    );
  }

  const tickets = new Map<string, T>();
  let attempts = 0;

  while (tickets.size < count) {
    attempts += 1;
    if (attempts > maxAttempts) {
      throw new Error(`无法生成${count}注互不重复的号码，请重新尝试。`);
    }

    const ticket = draw();
    tickets.set(ticketKey(ticket), ticket);
  }

  return [...tickets.values()];
}

export function validateBatch(type: LotteryType, tickets: Ticket[]): void {
  if (
    tickets.length < MIN_TICKET_COUNT ||
    tickets.length > MAX_TICKET_COUNT
  ) {
    throw new Error(
      `号码批次必须包含 ${MIN_TICKET_COUNT}–${MAX_TICKET_COUNT} 注。`,
    );
  }

  const keys = new Set<string>();

  for (const ticket of tickets) {
    if (ticket.type !== type) {
      throw new Error("号码批次中包含错误的彩票种类。");
    }

    if (ticket.type === "ssq") {
      if (
        ticket.red.length !== 6 ||
        new Set(ticket.red).size !== 6 ||
        ticket.red.some(
          (number) => !Number.isInteger(number) || number < 1 || number > 33,
        ) ||
        !Number.isInteger(ticket.blue) ||
        ticket.blue < 1 ||
        ticket.blue > 16
      ) {
        throw new Error("双色球号码不合法。");
      }

      if (
        ticket.red.some(
          (number, index) => index > 0 && number <= ticket.red[index - 1],
        )
      ) {
        throw new Error("红球必须按升序排列。");
      }
    } else {
      if (
        ticket.numbers.length !== 7 ||
        new Set(ticket.numbers).size !== 7 ||
        ticket.numbers.some(
          (number) => !Number.isInteger(number) || number < 1 || number > 30,
        )
      ) {
        throw new Error("七乐彩号码不合法。");
      }

      if (
        ticket.numbers.some(
          (number, index) => index > 0 && number <= ticket.numbers[index - 1],
        )
      ) {
        throw new Error("七乐彩号码必须按升序排列。");
      }
    }

    const key = ticketKey(ticket);
    if (keys.has(key)) {
      throw new Error("号码批次包含重复的完整投注组合。");
    }
    keys.add(key);
  }
}

export function generateSecureBatch(
  type: "ssq",
  count?: number,
  source?: RandomSource,
): SsqTicket[];
export function generateSecureBatch(
  type: "qlc",
  count?: number,
  source?: RandomSource,
): QlcTicket[];
export function generateSecureBatch(
  type: LotteryType,
  count?: number,
  source?: RandomSource,
): Ticket[];
export function generateSecureBatch(
  type: LotteryType,
  count = 5,
  source = createSecureRandomSource(),
): Ticket[] {
  if (type === "ssq") {
    const tickets = generateTickets<SsqTicket>(() => drawSsq(source), count);
    validateBatch("ssq", tickets);
    return tickets;
  }

  const tickets = generateTickets<QlcTicket>(() => drawQlc(source), count);
  validateBatch("qlc", tickets);
  return tickets;
}

function repeatSummary(numbers: number[]) {
  const counts = new Map<number, number>();
  for (const number of numbers) {
    counts.set(number, (counts.get(number) ?? 0) + 1);
  }

  let repeatedNumbers = 0;
  let repeatExcess = 0;
  for (const count of counts.values()) {
    if (count > 1) {
      repeatedNumbers += 1;
      repeatExcess += count - 1;
    }
  }

  return { repeatedNumbers, repeatExcess };
}

function coverage(unique: number, range: number): string {
  return `${((unique / range) * 100).toFixed(1)}%`;
}

export function calculateStatistics(
  type: LotteryType,
  tickets: Ticket[],
): LotteryStatistics {
  if (type === "ssq") {
    const redNumbers = tickets.flatMap((ticket) =>
      ticket.type === "ssq" ? ticket.red : [],
    );
    const blueNumbers = tickets.flatMap((ticket) =>
      ticket.type === "ssq" ? [ticket.blue] : [],
    );
    const uniqueRed = new Set(redNumbers).size;
    const uniqueBlue = new Set(blueNumbers).size;
    const redRepeats = repeatSummary(redNumbers);
    const blueRepeats = repeatSummary(blueNumbers);

    return {
      totalPicks: redNumbers.length,
      differentNumbers: uniqueRed,
      coverage: coverage(uniqueRed, 33),
      primaryRepeatedNumbers: redRepeats.repeatedNumbers,
      primaryRepeatExcess: redRepeats.repeatExcess,
      secondaryTotalPicks: blueNumbers.length,
      secondaryDifferentNumbers: uniqueBlue,
      secondaryCoverage: coverage(uniqueBlue, 16),
      secondaryRepeatedNumbers: blueRepeats.repeatedNumbers,
      secondaryRepeatExcess: blueRepeats.repeatExcess,
    };
  }

  const numbers = tickets.flatMap((ticket) =>
    ticket.type === "qlc" ? ticket.numbers : [],
  );
  const uniqueNumbers = new Set(numbers).size;
  const repeats = repeatSummary(numbers);

  return {
    totalPicks: numbers.length,
    differentNumbers: uniqueNumbers,
    coverage: coverage(uniqueNumbers, 30),
    primaryRepeatedNumbers: repeats.repeatedNumbers,
    primaryRepeatExcess: repeats.repeatExcess,
    secondaryTotalPicks: null,
    secondaryDifferentNumbers: null,
    secondaryCoverage: null,
    secondaryRepeatedNumbers: null,
    secondaryRepeatExcess: null,
  };
}

function pad(number: number): string {
  return String(number).padStart(2, "0");
}

export function formatSingleTicket(
  type: LotteryType,
  ticket: Ticket,
  ticketNumber: number,
): string {
  if (type === "ssq" && ticket.type === "ssq") {
    return `第${ticketNumber}注：${ticket.red.map(pad).join(" ")} + ${pad(ticket.blue)}`;
  }

  if (type === "qlc" && ticket.type === "qlc") {
    return `第${ticketNumber}注：${ticket.numbers.map(pad).join(" ")}`;
  }

  throw new Error("复制内容与当前彩票种类不匹配。");
}

export function formatAllNumbers(
  type: LotteryType,
  tickets: Ticket[],
): string {
  const header = lotteryMeta[type].name;
  return [
    header,
    ...tickets.map((ticket, index) =>
      formatSingleTicket(type, ticket, index + 1),
    ),
  ].join("\n");
}
