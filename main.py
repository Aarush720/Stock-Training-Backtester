from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from core_backtest import compute_risk_metrics, fetch_and_engineer, run_models

app = FastAPI(title="ML Trading Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class BacktestRequest(BaseModel):
    ticker: str = "AAPL"
    start_date: str = "2020-01-01"
    end_date: str = "2024-01-01"
    train_window: int = 200

@app.post("/api/run-backtest")
async def process_backtest(request: BacktestRequest):
    try:
        if request.train_window <= 0:
            raise ValueError("train_window must be greater than 0.")

        # Frontend currently sends train window in months (1-60).
        # Keep API backward compatible by treating values <= 60 as months.
        effective_window = request.train_window * 21 if request.train_window <= 60 else request.train_window

        df = fetch_and_engineer(request.ticker, request.start_date, request.end_date)

        if len(df) <= effective_window:
            raise ValueError(
                f"Not enough data for train_window={request.train_window}. "
                f"Try a smaller train window or wider date range."
            )

        results = run_models(df, effective_window)

        if results.empty:
            raise ValueError("Backtest produced no results. Try a wider date range.")
        
        dt_total = (results['Cum_DT'].iloc[-1] - 1) * 100
        hold_total = (results['Cum_Hold'].iloc[-1] - 1) * 100
        ma_total = (results['Cum_MA'].iloc[-1] - 1) * 100
        sharpe_ratio, max_drawdown = compute_risk_metrics(results['Return_DT'])

        starting_capital = 10000
        
        chart_data = []
        for index, row in results.iterrows():
            chart_data.append({
                "date": index.strftime("%Y-%m-%d"),
                "AI": round(row['Cum_DT'] * starting_capital, 2),
                "Benchmark": round(row['Cum_Hold'] * starting_capital, 2),
                "Benchmark_MA": round(row['Cum_MA'] * starting_capital, 2)
            })
            
        return {
            "status": "success",
            "metrics": {
                "ai_return": round(dt_total, 2),
                "benchmark_return": round(hold_total, 2),
                "ma_benchmark_return": round(ma_total, 2), # New metric for frontend cards
                "alpha": round(dt_total - hold_total, 2),
                "sharpe_ratio": round(sharpe_ratio, 2),
                "max_drawdown": round(max_drawdown, 2)
            },
            "chart_data": chart_data 
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))