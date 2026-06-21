#!/usr/bin/env python3
"""
泡泡玛特 (09992.HK) 综合分析脚本
对比标的：中国移动 (00941.HK)、中海油 (00883.HK)
运行方式：python3 popmart_analysis.py
"""
import akshare as ak
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import json

pd.set_option('display.max_columns', None)
pd.set_option('display.width', 200)
pd.set_option('display.max_rows', 50)

# ============================================================
# 0. 用户持仓信息
# ============================================================
print("=" * 70)
print("用户持仓汇总")
print("=" * 70)
positions = {
    "深港通 200股": {"cost": 165.73, "shares": 200},
    "沪港通 600股": {"cost": 173.67, "shares": 600},
}
total_shares = sum(v["shares"] for v in positions.values())
total_cost = sum(v["cost"] * v["shares"] for v in positions.values())
avg_cost = total_cost / total_shares
current_price = 164.30  # 给定现价
total_market_value = current_price * total_shares
total_pnl = total_market_value - total_cost
pnl_pct = (current_price / avg_cost - 1) * 100

print(f"  总持股: {total_shares} 股")
print(f"  加权平均成本: HK${avg_cost:.2f}")
print(f"  现价: HK${current_price:.2f}")
print(f"  总市值: HK${total_market_value:,.0f} (约 ¥{total_market_value*0.93:,.0f})")
print(f"  浮动盈亏: HK${total_pnl:,.0f} ({pnl_pct:+.2f}%)")

# ============================================================
# 1. 泡泡玛特 09992.HK 财务数据
# ============================================================
print("\n" + "=" * 70)
print("1. 泡泡玛特 (09992.HK) 核心财务数据")
print("=" * 70)

# 1a. 实时行情
try:
    spot = ak.stock_hk_spot_em()
    popmart_spot = spot[spot["代码"] == "09992"]
    if len(popmart_spot) > 0:
        row = popmart_spot.iloc[0]
        current_price = float(row["最新价"])
        print(f"\n  实时价格: HK${current_price:.2f}")
        print(f"  涨跌幅: {row['涨跌幅']}%")
        print(f"  成交量: {row['成交量']:,}")
        print(f"  成交额: {row['成交额']:,}")
        print(f"  52周最高: HK${row.get('52周最高', 'N/A')}")
        print(f"  52周最低: HK${row.get('52周最低', 'N/A')}")
        print(f"  总市值: {row.get('总市值', 'N/A')}")
except Exception as e:
    print(f"  实时行情获取失败: {e}")

# 1b. 财务指标
try:
    fin = ak.stock_hk_financial_indicator_em(symbol="09992")
    print(f"\n  财务指标数据 (共{len(fin)}期):")
    # 最新几期
    cols = ["日期", "净资产收益率", "总资产净利润率", "毛利率", "净利率",
            "营业总收入同比增长", "归属母公司净利润同比增长",
            "每股净资产", "每股营业收入", "每股收益"]
    available = [c for c in cols if c in fin.columns]
    print(fin[available].tail(6).to_string())

    # 最新一期核心指标
    latest = fin.iloc[-1]
    print(f"\n  === 最新一期 ({latest['日期']}) 核心指标 ===")
    for key in ["净资产收益率", "毛利率", "净利率", "营业总收入同比增长",
                "归属母公司净利润同比增长", "每股收益", "每股净资产"]:
        if key in latest:
            print(f"  {key}: {latest[key]}")
except Exception as e:
    print(f"  财务指标获取失败: {e}")

# 1c. 利润表
try:
    income = ak.stock_hk_profit_forecast_em(symbol="09992")
    print(f"\n  利润预测:")
    print(income.to_string())
except Exception as e:
    print(f"  利润预测获取失败: {e}")

# 1d. 历史K线 (技术分析)
try:
    # 获取近2年日K线
    end_date = datetime.now().strftime("%Y%m%d")
    start_date = (datetime.now() - timedelta(days=730)).strftime("%Y%m%d")
    hist = ak.stock_hk_hist(symbol="09992", period="daily",
                            start_date=start_date, end_date=end_date,
                            adjust="qfq")

    if len(hist) > 0:
        print(f"\n  === 技术分析 ===")
        print(f"  历史数据: {len(hist)} 个交易日")

        # MA
        hist['MA20'] = hist['收盘'].rolling(20).mean()
        hist['MA60'] = hist['收盘'].rolling(60).mean()
        hist['MA120'] = hist['收盘'].rolling(120).mean()
        hist['MA250'] = hist['收盘'].rolling(250).mean()

        latest_close = hist['收盘'].iloc[-1]
        ma20 = hist['MA20'].iloc[-1]
        ma60 = hist['MA60'].iloc[-1]
        ma120 = hist['MA120'].iloc[-1]
        ma250 = hist['MA250'].iloc[-1]

        print(f"  最新收盘: HK${latest_close:.2f}")
        print(f"  MA20:  HK${ma20:.2f}  ({'上方' if latest_close > ma20 else '下方'} {abs(latest_close/ma20-1)*100:.1f}%)")
        print(f"  MA60:  HK${ma60:.2f}  ({'上方' if latest_close > ma60 else '下方'} {abs(latest_close/ma60-1)*100:.1f}%)")
        print(f"  MA120: HK${ma120:.2f} ({'上方' if latest_close > ma120 else '下方'} {abs(latest_close/ma120-1)*100:.1f}%)")
        print(f"  MA250: HK${ma250:.2f} ({'上方' if latest_close > ma250 else '下方'} {abs(latest_close/ma250-1)*100:.1f}%)")

        # 年内高低点
        ytd = hist[hist['日期'] >= f"{datetime.now().year}-01-01"]
        if len(ytd) > 0:
            ytd_high = ytd['最高'].max()
            ytd_low = ytd['最低'].min()
            print(f"\n  年内最高: HK${ytd_high:.2f}")
            print(f"  年内最低: HK${ytd_low:.2f}")
            print(f"  现价距年内高点: {(latest_close/ytd_high-1)*100:+.1f}%")
            print(f"  现价距年内低点: {(latest_close/ytd_low-1)*100:+.1f}%")

        # 布林带
        hist['BB_MID'] = hist['MA20']
        hist['BB_STD'] = hist['收盘'].rolling(20).std()
        hist['BB_UP'] = hist['BB_MID'] + 2 * hist['BB_STD']
        hist['BB_DN'] = hist['BB_MID'] - 2 * hist['BB_STD']
        bb_up = hist['BB_UP'].iloc[-1]
        bb_dn = hist['BB_DN'].iloc[-1]
        print(f"\n  布林带上轨: HK${bb_up:.2f}")
        print(f"  布林带中轨: HK${ma20:.2f}")
        print(f"  布林带下轨: HK${bb_dn:.2f}")
        print(f"  布林带宽度: {(bb_up-bb_dn)/ma20*100:.1f}%")

        # RSI
        delta = hist['收盘'].diff()
        gain = delta.clip(lower=0)
        loss = -delta.clip(upper=0)
        avg_gain = gain.rolling(14).mean()
        avg_loss = loss.rolling(14).mean()
        rs = avg_gain / avg_loss
        hist['RSI'] = 100 - (100 / (1 + rs))
        rsi = hist['RSI'].iloc[-1]
        print(f"\n  RSI(14): {rsi:.1f} {'(超买)' if rsi > 70 else '(超卖)' if rsi < 30 else '(中性)'}")

except Exception as e:
    print(f"  历史K线获取失败: {e}")

# ============================================================
# 2. 港股消费板块资金流向
# ============================================================
print("\n" + "=" * 70)
print("2. 港股消费板块资金流向")
print("=" * 70)

# 2a. 南向资金
try:
    # 港股通资金流向
    south = ak.stock_hsgt_hist_em(symbol="港股通（沪）")
    print(f"\n  港股通(沪) 近20日资金流向:")
    print(south.tail(20).to_string())
except Exception as e:
    print(f"  南向资金获取失败: {e}")

try:
    south_sz = ak.stock_hsgt_hist_em(symbol="港股通（深）")
    print(f"\n  港股通(深) 近10日资金流向:")
    print(south_sz.tail(10).to_string())
except Exception as e:
    print(f"  深股通获取失败: {e}")

# 2b. 港股消费板块指数
try:
    # 港股消费指数
    hs_consume = ak.stock_hk_index_spot_em()
    consume_related = hs_consume[hs_consume["名称"].str.contains("消费|零售|餐饮|体育|娱乐", na=False)]
    if len(consume_related) > 0:
        print(f"\n  港股消费相关指数:")
        print(consume_related[["代码", "名称", "最新价", "涨跌幅"]].to_string())
except Exception as e:
    print(f"  消费指数获取失败: {e}")

# ============================================================
# 3. 横向对比: 中国移动 vs 中海油 vs 泡泡玛特
# ============================================================
print("\n" + "=" * 70)
print("3. 横向对比: 泡泡玛特 vs 中国移动 vs 中海油")
print("=" * 70)

stocks = {
    "09992": "泡泡玛特",
    "00941": "中国移动",
    "00883": "中海油"
}

comparison_data = {}

for code, name in stocks.items():
    print(f"\n  --- {name} ({code}.HK) ---")
    try:
        # 实时行情
        spot = ak.stock_hk_spot_em()
        s = spot[spot["代码"] == code]
        if len(s) > 0:
            row = s.iloc[0]
            price = float(row["最新价"])
            chg = row["涨跌幅"]
            mkt_cap = row.get("总市值", "N/A")
            pe = row.get("市盈率", "N/A")
            pb = row.get("市净率", "N/A")
            print(f"    现价: HK${price:.2f}  涨跌: {chg}%")
            print(f"    总市值: {mkt_cap}")
            print(f"    PE: {pe}  PB: {pb}")
            comparison_data[code] = {
                "name": name, "price": price, "chg": chg,
                "pe": pe, "pb": pb, "mkt_cap": mkt_cap
            }
    except Exception as e:
        print(f"    行情获取失败: {e}")
        # 单独获取
        try:
            s_spot = ak.stock_hk_spot_em()
            s_row = s_spot[s_spot["代码"] == code]
            if len(s_row) > 0:
                r = s_row.iloc[0]
                print(f"    现价: {r['最新价']}  PE: {r.get('市盈率','N/A')}  PB: {r.get('市净率','N/A')}")
        except:
            pass

    # 财务指标
    try:
        fin = ak.stock_hk_financial_indicator_em(symbol=code)
        latest = fin.iloc[-1]
        print(f"    ROE: {latest.get('净资产收益率', 'N/A')}")
        print(f"    营收同比: {latest.get('营业总收入同比增长', 'N/A')}")
        print(f"    利润同比: {latest.get('归属母公司净利润同比增长', 'N/A')}")
        print(f"    毛利率: {latest.get('毛利率', 'N/A')}")
        print(f"    净利率: {latest.get('净利率', 'N/A')}")
        print(f"    每股收益: {latest.get('每股收益', 'N/A')}")
        print(f"    每股净资产: {latest.get('每股净资产', 'N/A')}")
        comparison_data[code]["roe"] = latest.get('净资产收益率', 'N/A')
        comparison_data[code]["rev_growth"] = latest.get('营业总收入同比增长', 'N/A')
        comparison_data[code]["profit_growth"] = latest.get('归属母公司净利润同比增长', 'N/A')
    except Exception as e:
        print(f"    财务获取失败: {e}")

# 分红率对比
print("\n  === 分红对比 ===")
for code, name in stocks.items():
    try:
        div = ak.stock_hk_dividend_hist_em(symbol=code)
        if len(div) > 0:
            # 最近一年分红
            recent_div = div.head(2)
            total_div = recent_div["派息金额"].sum() if "派息金额" in recent_div.columns else "N/A"
            print(f"  {name}: 最近分红记录 = {recent_div[['除权日','派息金额']].to_string(index=False) if len(recent_div)>0 else 'N/A'}")
    except Exception as e:
        print(f"  {name}: 分红数据获取失败: {e}")

# ============================================================
# 4. 机构研报预测
# ============================================================
print("\n" + "=" * 70)
print("4. 泡泡玛特机构盈利预测")
print("=" * 70)
try:
    forecast = ak.stock_hk_profit_forecast_em(symbol="09992")
    print(forecast.to_string())
except Exception as e:
    print(f"  盈利预测获取失败: {e}")

# ============================================================
# 5. 综合评分与建议
# ============================================================
print("\n" + "=" * 70)
print("5. 综合评分 (满分10分)")
print("=" * 70)

scores = {}
for code in ["09992", "00941", "00883"]:
    name = stocks[code]
    cd = comparison_data.get(code, {})
    score = 5.0  # 基准分

    # PE 评分 (越低越好)
    try:
        pe = float(cd.get("pe", 999))
        if pe < 5: score += 2
        elif pe < 10: score += 1.5
        elif pe < 15: score += 1
        elif pe < 20: score += 0.5
        elif pe < 30: score += 0
        else: score -= 1
    except: pass

    # ROE 评分 (越高越好)
    try:
        roe = float(cd.get("roe", 0))
        if roe > 30: score += 2
        elif roe > 20: score += 1.5
        elif roe > 15: score += 1
        elif roe > 10: score += 0.5
        else: score -= 0.5
    except: pass

    # 增长评分
    try:
        profit_g = float(cd.get("profit_growth", 0))
        if profit_g > 50: score += 2.5
        elif profit_g > 30: score += 2
        elif profit_g > 20: score += 1.5
        elif profit_g > 10: score += 1
        elif profit_g > 0: score += 0.5
        else: score -= 1
    except: pass

    scores[code] = min(10, max(1, score))
    print(f"  {name}: {scores[code]:.1f}/10")

print("\n" + "=" * 70)
print("数据拉取完成。请将以上输出提供给 AI 进行进一步分析。")
print("=" * 70)
