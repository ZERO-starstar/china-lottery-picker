import { describe, expect, it } from "vitest";
import {
  calculateStatistics,
  createSecureRandomSource,
  formatAllNumbers,
  formatSingleTicket,
  generateSecureBatch,
  generateTickets,
  randomInt,
  ticketKey,
  validateBatch,
} from "./lottery";

describe("cryptographically secure random selection", () => {
  it("uses Web Crypto getRandomValues through the secure source", () => {
    let calls = 0;
    const secureSource = createSecureRandomSource({
      getRandomValues<T extends ArrayBufferView | null>(array: T): T {
        calls += 1;
        if (array instanceof Uint32Array) {
          array.fill(0xffffffff);
        }
        return array;
      },
    });

    secureSource.nextUint32();
    expect(calls).toBeGreaterThan(0);
  });

  it("shows no large skew in a finite random-integer sample", () => {
    // This is a sanity check, not a mathematical proof of perfect uniformity.
    let state = 0x9e3779b9;
    const source = {
      nextUint32() {
        state = (Math.imul(1_664_525, state) + 1_013_904_223) >>> 0;
        return state;
      },
    };
    const counts = Array.from({ length: 6 }, () => 0);
    const samples = 90_000;

    for (let index = 0; index < samples; index += 1) {
      counts[randomInt(6, source)] += 1;
    }

    for (const count of counts) {
      expect(Math.abs(count - samples / 6)).toBeLessThan(samples / 50);
    }
  });
});

describe("双色球 generation", () => {
  it("generates exactly five legal, sorted, unique complete tickets", () => {
    const tickets = generateSecureBatch("ssq", 5);

    expect(tickets).toHaveLength(5);
    for (const ticket of tickets) {
      expect(ticket.type).toBe("ssq");
      expect(ticket.red).toHaveLength(6);
      expect(new Set(ticket.red).size).toBe(6);
      expect(ticket.red.every((number) => number >= 1 && number <= 33)).toBe(
        true,
      );
      expect(ticket.red).toEqual([...ticket.red].sort((a, b) => a - b));
      expect(ticket.blue).toBeGreaterThanOrEqual(1);
      expect(ticket.blue).toBeLessThanOrEqual(16);
    }

    const keys = tickets.map(
      (ticket) => `${ticket.red.join(",")}+${ticket.blue}`,
    );
    expect(new Set(keys).size).toBe(5);
  });
});

describe("七乐彩 generation", () => {
  it("generates five legal, sorted, unique seven-number tickets with no special number", () => {
    const tickets = generateSecureBatch("qlc", 5);

    expect(tickets).toHaveLength(5);
    for (const ticket of tickets) {
      expect(ticket.type).toBe("qlc");
      expect(ticket.numbers).toHaveLength(7);
      expect(new Set(ticket.numbers).size).toBe(7);
      expect(
        ticket.numbers.every((number) => number >= 1 && number <= 30),
      ).toBe(true);
      expect(ticket.numbers).toEqual(
        [...ticket.numbers].sort((a, b) => a - b),
      );
      expect(ticket).not.toHaveProperty("special");
      expect(ticket).not.toHaveProperty("blue");
    }

    const keys = tickets.map((ticket) => ticket.numbers.join(","));
    expect(new Set(keys).size).toBe(5);
  });
});

describe("batch validation and retry handling", () => {
  it("rejects duplicated complete combinations", () => {
    const ticket = { type: "ssq" as const, red: [1, 2, 3, 4, 5, 6], blue: 7 };
    expect(() =>
      validateBatch("ssq", [
        ticket,
        ticket,
        { ...ticket, blue: 8 },
        { ...ticket, blue: 9 },
        { ...ticket, blue: 10 },
      ]),
    ).toThrow("包含重复的完整投注组合");
  });

  it("retries a duplicated draw until five unique tickets are available", () => {
    const repeated = {
      type: "ssq" as const,
      red: [1, 2, 3, 4, 5, 6],
      blue: 7,
    };
    let calls = 0;
    const tickets = generateTickets(() => {
      calls += 1;
      if (calls <= 2) return repeated;
      return { ...repeated, blue: 7 + calls };
    }, 5);

    expect(tickets).toHaveLength(5);
    expect(new Set(tickets.map((ticket) => JSON.stringify(ticket))).size).toBe(
      5,
    );
    expect(calls).toBeGreaterThan(5);
  });

  it("supports an arbitrary requested ticket count", () => {
    const ssq = generateSecureBatch("ssq", 3);
    const qlc = generateSecureBatch("qlc", 12);

    expect(ssq).toHaveLength(3);
    expect(qlc).toHaveLength(12);
    expect(new Set(ssq.map(ticketKey)).size).toBe(3);
    expect(new Set(qlc.map(ticketKey)).size).toBe(12);
  });

  it("rejects ticket counts outside the supported range", () => {
    expect(() => generateSecureBatch("ssq", 0)).toThrow(
      "生成注数必须是 1–100 之间的整数",
    );
    expect(() => generateSecureBatch("qlc", 101)).toThrow(
      "生成注数必须是 1–100 之间的整数",
    );
  });
});

describe("statistics and copy formatting", () => {
  it("calculates 双色球 coverage and cross-ticket red repeats from actual tickets", () => {
    const tickets = [
      { type: "ssq" as const, red: [1, 2, 3, 4, 5, 6], blue: 1 },
      { type: "ssq" as const, red: [1, 2, 3, 7, 8, 9], blue: 2 },
      { type: "ssq" as const, red: [10, 11, 12, 13, 14, 15], blue: 1 },
      { type: "ssq" as const, red: [16, 17, 18, 19, 20, 21], blue: 3 },
      { type: "ssq" as const, red: [22, 23, 24, 25, 26, 27], blue: 4 },
    ];
    const stats = calculateStatistics("ssq", tickets);

    expect(stats.totalPicks).toBe(30);
    expect(stats.differentNumbers).toBe(27);
    expect(stats.coverage).toBe("81.8%");
    expect(stats.primaryRepeatedNumbers).toBe(3);
    expect(stats.primaryRepeatExcess).toBe(3);
    expect(stats.secondaryTotalPicks).toBe(5);
    expect(stats.secondaryDifferentNumbers).toBe(4);
    expect(stats.secondaryCoverage).toBe("25.0%");
  });

  it("calculates 七乐彩 coverage from its 1–30 range", () => {
    const tickets = [
      ...Array.from({ length: 4 }, (_, index) => ({
        type: "qlc" as const,
        numbers: Array.from(
          { length: 7 },
          (__, numberIndex) => index * 7 + numberIndex + 1,
        ),
      })),
      {
      type: "qlc" as const,
        numbers: [1, 2, 3, 4, 5, 29, 30],
      },
    ];
    const stats = calculateStatistics("qlc", tickets);

    expect(stats.totalPicks).toBe(35);
    expect(stats.differentNumbers).toBe(30);
    expect(stats.coverage).toBe("100.0%");
    expect(stats.primaryRepeatedNumbers).toBe(5);
    expect(stats.primaryRepeatExcess).toBe(5);
    expect(stats.secondaryTotalPicks).toBeNull();
  });

  it("formats only the active lottery for copying", () => {
    const ssq = [
      {
        type: "ssq" as const,
        red: [3, 8, 12, 19, 25, 31],
        blue: 9,
      },
    ];
    const qlc = [
      {
        type: "qlc" as const,
        numbers: [3, 6, 9, 13, 17, 22, 28],
      },
    ];

    expect(formatSingleTicket("ssq", ssq[0], 1)).toBe(
      "第1注：03 08 12 19 25 31 + 09",
    );
    expect(formatSingleTicket("qlc", qlc[0], 1)).toBe(
      "第1注：03 06 09 13 17 22 28",
    );
    expect(formatAllNumbers("ssq", ssq)).toContain("双色球");
    expect(formatAllNumbers("ssq", ssq)).not.toContain("七乐彩");
    expect(formatAllNumbers("qlc", qlc)).toContain("七乐彩");
  });
});
