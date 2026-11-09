import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

describe("lottery picker page", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("starts with 双色球 and only one current lottery selector is visible", () => {
    render(<App />);

    expect(screen.getByLabelText("选择彩票种类")).toHaveValue("ssq");
    expect(screen.getByRole("heading", { name: "双色球" })).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "双色球" })).getByText(
        "33 选 6 个红球，16 选 1 个蓝球",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "七乐彩" })).not.toBeInTheDocument();
    expect(
      screen.getByText("1 / 17,721,088", { selector: "[data-probability]" }),
    ).toBeInTheDocument();
  });

  it("generates five 双色球 tickets and calculates their statistics", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "生成5注号码" }));

    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByText("本次生成：5注")).toBeInTheDocument();
    expect(screen.getByText("红球总出现次数")).toBeInTheDocument();
    expect(screen.getByText("30 次")).toBeInTheDocument();
    expect(screen.getByText("蓝球总出现次数")).toBeInTheDocument();
    expect(screen.getByText("5 次")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "复制全部5注" })).toBeEnabled();
  });

  it("clears old numbers when switching to 七乐彩 and copies only the active lottery", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "生成5注号码" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(5);

    await user.selectOptions(screen.getByLabelText("选择彩票种类"), "qlc");

    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.getByRole("heading", { name: "七乐彩" })).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "七乐彩" })).getByText(
        "30 选 7 个基本号码",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("1 / 2,035,800", { selector: "[data-probability]" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "复制全部5注" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "生成5注号码" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByText("号码总出现次数")).toBeInTheDocument();
    expect(screen.getByText("35 次")).toBeInTheDocument();
    expect(screen.getByText("特别号码不参与选号")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "复制全部5注" }));
    const copiedText = await navigator.clipboard.readText();
    expect(copiedText).toMatch(/^七乐彩\n第1注：/);
    expect(copiedText).not.toContain("双色球");

    expect(await screen.findByRole("status")).toHaveTextContent("已复制");
  });

  it("clears 七乐彩 results when switching back to 双色球", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByLabelText("选择彩票种类"), "qlc");
    await user.click(screen.getByRole("button", { name: "生成5注号码" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(5);

    await user.selectOptions(screen.getByLabelText("选择彩票种类"), "ssq");

    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.getByRole("heading", { name: "双色球" })).toBeInTheDocument();
    expect(screen.queryByText("特别号码不参与选号")).not.toBeInTheDocument();
    expect(
      screen.getByText("5 / 17,721,088", { selector: "[data-probability]" }),
    ).toBeInTheDocument();
  });

  it("copies one 双色球 ticket in the required format", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "生成5注号码" }));

    const firstTicket = screen.getAllByRole("listitem")[0];
    await user.click(
      within(firstTicket).getByRole("button", { name: "复制第1注" }),
    );

    const copiedText = await navigator.clipboard.readText();
    expect(copiedText).toMatch(/^第1注：\d{2} \d{2} \d{2} \d{2} \d{2} \d{2} \+ \d{2}$/);
  });

  it("generates and copies the requested number of tickets", async () => {
    const user = userEvent.setup();
    render(<App />);

    const countInput = screen.getByLabelText("生成注数");
    await user.clear(countInput);
    await user.type(countInput, "3");
    await user.click(screen.getByRole("button", { name: "生成3注号码" }));

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("本次生成：3注")).toBeInTheDocument();
    expect(screen.getByText("18 次")).toBeInTheDocument();
    expect(
      screen.getByText("3 / 17,721,088", {
        selector: "[data-probability]",
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "复制全部3注" }));
    const copiedText = await navigator.clipboard.readText();
    expect(copiedText).toMatch(/^双色球\n第1注：/);
    expect(copiedText.split("\n")).toHaveLength(4);
  });

  it("clears previous results when the ticket count changes", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "生成5注号码" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(5);

    const countInput = screen.getByLabelText("生成注数");
    await user.clear(countInput);
    await user.type(countInput, "4");

    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "复制全部4注" })).toBeDisabled();
    expect(
      screen.getByText("4 / 17,721,088", {
        selector: "[data-probability]",
      }),
    ).toBeInTheDocument();
  });
});
