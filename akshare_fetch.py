#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
A 股持仓深度分析 - AkShare 数据拉取脚本
股票：601066 中信建投 / 002340 格林美 / 002241 歌尔股份 / 300660 江苏雷利
日期：2026-06-21
"""

import akshare as ak
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# ============================================================
# 1. 基础行情数据
# ============================================================
codes = ["601066", "002340", "002241", "300660"]
names = ["中信建投", "格林美", "歌尔股份", "江苏雷利"]
costs = [23.33, 8.77, 25.41, 35.41]
holdings = [4000, 16000, 400, 390]

print("=" * 80)
print("【基础行情快照】")
print("=" * 80)

# 实时行情
df_spot = ak.stock_zh_a_spot_em()
for code in codes:
    row = df_spot[df_spot["代码"] == code]
    if not row.empty:
        r = row.iloc[0]
        print(f"\n{r['名称']} ({code})")
        print(f"  现价: {r['最新价']}  涨跌幅: {r['涨跌幅']}%")
        print(f"  成交量: {r['成交量']}手  成交额: {r['成交额']}元")
        print(f"  最高: {r['最高']}  最低: {r['最低']}")
        print(f"  换手率: {r.get('换手率', 'N/A')}%")
        print(f"  量比: {r.get('量比', 'N/A')}")

# ============================================================
# 2. 财务指标 — PE / PB / ROE / 营收增速 / 利润增速
# ============================================================
print("\n" + "=" * 80)
print("【核心财务指标】")
print("=" * 80)

for code, name in zip(codes, names):
    print(f"\n{'─' * 60}")
    print(f"  {name} ({code})")
    print(f"{'─' * 60}")

    # --- 2a. 个股信息（含 PE/PB）---
    try:
        info = ak.stock_individual_info_em(symbol=code)
        print("  [个股信息]")
        # 常见字段：市盈率-动态, 市净率, 总市值, 流通市值, 营业收入, 净利润(不保证字段名)
        for _, r in info.iterrows():
            key = r["item"]
            val = r["value"]
            print(f"    {key}: {val}")
    except Exception as e:
        print(f"    [个股信息拉取失败] {e}")

    # --- 2b. 财务指标（ROE 等）---
    try:
        fin = ak.stock_financial_analysis_indicator(symbol=code)
        latest_col = fin.columns[-1]  # 最新一期
        print(f"\n  [财务指标-{latest_col}]")
        for _, r in fin.iterrows():
            ind = r["指标"]
            val = r[latest_col]
            if any(kw in str(ind) for kw in ["ROE", "净利率", "毛利率", "营收", "收入", "同比增长", "资产负债"]):
                print(f"    {ind}: {val}")
    except Exception as e:
        print(f"    [财务指标拉取失败] {e}")

    # --- 2c. 利润表（找营收增速、利润增速）---
    try:
        income = ak.stock_profit_sheet_by_report_em(symbol=code)
        # 看看最近两期
        print(f"\n  [利润表摘要]")
        cols_show = [c for c in income.columns if "营业" in str(c) or "净利润" in str(c) or "归属" in str(c)]
        if len(income) >= 2:
            latest = income.iloc[0]
            prev = income.iloc[1]
            print(f"    最新期: {latest.get('报告期', latest.name)}")
            for c in cols_show:
                if c in income.columns:
                    cur_val = latest[c]
                    prev_val = prev[c]
                    if isinstance(cur_val, (int, float)) and isinstance(prev_val, (int, float)) and prev_val != 0:
                        growth = (cur_val - prev_val) / abs(prev_val) * 100
                        print(f"    {c}: {cur_val:.2f}  (同比 {growth:+.2f}%)")
                    else:
                        print(f"    {c}: {cur_val}")
    except Exception as e:
        print(f"    [利润表拉取失败] {e}")

# ============================================================
# 3. 历史 K 线 — 技术面分析
# ============================================================
print("\n" + "=" * 80)
print("【技术面分析 — 日线 MA/支撑/压力】")
print("=" * 80)

for code, name in zip(codes, names):
    try:
        # 取近 250 个交易日的日线
        end_date = datetime.now().strftime("%Y%m%d")
        start_date = (datetime.now() - timedelta(days=400)).strftime("%Y%m%d")
        kline = ak.stock_zh_a_hist(symbol=code, period="daily",
                                   start_date=start_date, end_date=end_date,
                                   adjust="qfq")
        if kline.empty:
            print(f"\n{name} ({code}): 无 K 线数据")
            continue

        kline["MA5"] = kline["收盘"].rolling(5).mean()
        kline["MA10"] = kline["收盘"].rolling(10).mean()
        kline["MA20"] = kline["收盘"].rolling(20).mean()
        kline["MA60"] = kline["收盘"].rolling(60).mean()
        kline["MA120"] = kline["收盘"].rolling(120).mean()

        latest = kline.iloc[-1]
        close = latest["收盘"]
        ma5 = latest["MA5"]
        ma10 = latest["MA10"]
        ma20 = latest["MA20"]
        ma60 = latest["MA60"]
        ma120 = latest["MA120"]

        # 近 60 日最高/最低作为压力/支撑参考
        recent_60 = kline.tail(60)
        high_60 = recent_60["最高"].max()
        low_60 = recent_60["最低"].min()
        recent_20 = kline.tail(20)
        high_20 = recent_20["最高"].max()
        low_20 = recent_20["最低"].min()

        # 趋势判断
        if ma5 > ma10 > ma20 > ma60 > ma120:
            trend = "多头排列（强势上涨）"
        elif ma5 < ma10 < ma20 < ma60 < ma120:
            trend = "空头排列（弱势下跌）"
        elif close > ma60:
            trend = "中期偏多（站上60日均线）"
        elif close < ma60:
            trend = "中期偏空（跌破60日均线）"
        else:
            trend = "震荡格局"

        # ATR (14)
        kline["TR"] = np.maximum(
            kline["最高"] - kline["最低"],
            np.maximum(
                abs(kline["最高"] - kline["收盘"].shift(1)),
                abs(kline["最低"] - kline["收盘"].shift(1)),
            ),
        )
        atr14 = kline["TR"].rolling(14).mean().iloc[-1]

        # RSI (14)
        delta = kline["收盘"].diff()
        gain = delta.clip(lower=0).rolling(14).mean()
        loss = (-delta.clip(upper=0)).rolling(14).mean()
        rs = gain / loss
        rsi14 = 100 - (100 / (1 + rs.iloc[-1])) if loss.iloc[-1] != 0 else 50

        print(f"\n{'─' * 60}")
        print(f"  {name} ({code})")
        print(f"{'─' * 60}")
        print(f"  最新收盘: {close}")
        print(f"  MA5: {ma5:.2f}  MA10: {ma10:.2f}  MA20: {ma20:.2f}")
        print(f"  MA60: {ma60:.2f}  MA120: {ma120:.2f}")
        print(f"  趋势判断: {trend}")
        print(f"  近期压力 (60日最高): {high_60:.2f}")
        print(f"  近期支撑 (60日最低): {low_60:.2f}")
        print(f"  近期压力 (20日最高): {high_20:.2f}")
        print(f"  近期支撑 (20日最低): {low_20:.2f}")
        print(f"  ATR(14): {atr14:.2f}")
        print(f"  RSI(14): {rsi14:.2f}")

        # MACD
        ema12 = kline["收盘"].ewm(span=12, adjust=False).mean()
        ema26 = kline["收盘"].ewm(span=26, adjust=False).mean()
        dif = ema12 - ema26
        dea = dif.ewm(span=9, adjust=False).mean()
        macd_bar = 2 * (dif - dea)
        print(f"  MACD_DIF: {dif.iloc[-1]:.3f}  DEA: {dea.iloc[-1]:.3f}  BAR: {macd_bar.iloc[-1]:.3f}")

    except Exception as e:
        print(f"\n{name} ({code}): 技术分析拉取失败 — {e}")

# ============================================================
# 4. 机构研报/最新评级
# ============================================================
print("\n" + "=" * 80)
print("【近期机构评级】")
print("=" * 80)
for code, name in zip(codes, names):
    try:
        rating = ak.stock_em_comment(symbol=code)
        print(f"\n  {name} ({code}): 最近 3 条")
        for i, (_, r) in enumerate(rating.head(3).iterrows()):
            print(f"    {r.get('时间', '')} | {r.get('机构', '')} | {r.get('评级', '')}")
    except Exception as e:
        print(f"  {name} ({code}): 评级拉取失败 — {e}")

print("\n" + "=" * 80)
print("数据拉取完成！")
print("=" * 80)
