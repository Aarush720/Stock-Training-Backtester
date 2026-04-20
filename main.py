from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yfinance as yf
import pandas as pd
import numpy as np
from sklearn.tree import DecisionTreeRegressor
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor

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


def compute_rsi(returns, window=14):
    gains = returns.clip(lower=0)
    losses = -returns.clip(upper=0)
    avg_gain = gains.rolling(window=window).mean()
    avg_loss = losses.rolling(window=window).mean()
    rs = avg_gain / (avg_loss + 1e-10)
    return 100 - (100 / (1 + rs))

def compute_risk_metrics(strategy_returns):
    daily_mean = strategy_returns.mean()
    daily_std = strategy_returns.std()

    if pd.isna(daily_std) or daily_std == 0:
        sharpe = 0.0
    else:
        sharpe = (daily_mean / daily_std) * np.sqrt(252)

    cumulative = (1 + strategy_returns).cumprod()
    running_max = cumulative.cummax()
    drawdown = (cumulative / running_max) - 1
    max_drawdown = drawdown.min() * 100

    return float(sharpe), float(max_drawdown)

def fetch_and_engineer(ticker, start, end):
    df = yf.download(ticker, start=start, end=end)
    if df.empty:
        raise ValueError("No data found.")
    
    df = df[['Close']].copy()
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = ['Close']
        
    df['Return'] = df['Close'].pct_change()
    df['MA10'] = df['Close'].rolling(window=10).mean()
    df['MA20'] = df['Close'].rolling(window=20).mean()
    df['MA50'] = df['Close'].rolling(window=50).mean()
    df['MA_diff'] = df['MA10'] - df['MA50']
    df['EMA12'] = df['Close'].ewm(span=12, adjust=False).mean()
    df['EMA26'] = df['Close'].ewm(span=26, adjust=False).mean()
    df['MACD'] = df['EMA12'] - df['EMA26']
    df['MACD_signal'] = df['MACD'].ewm(span=9, adjust=False).mean()
    df['Volatility'] = df['Return'].rolling(window=10).std()
    df['Momentum_5'] = df['Close'].pct_change(periods=5)
    df['Momentum_20'] = df['Close'].pct_change(periods=20)
    df['RSI14'] = compute_rsi(df['Return'], window=14)
    df['Return_1'] = df['Return'].shift(1)
    df['Return_2'] = df['Return'].shift(2)
    df['Return_3'] = df['Return'].shift(3)
    df['Target'] = df['Return'].shift(-1)
    df.dropna(inplace=True)
    return df

def run_models(df, window):
    features = [
        'Return', 'MA10', 'MA20', 'MA50', 'MA_diff', 'Volatility',
        'EMA12', 'EMA26', 'MACD', 'MACD_signal', 'Momentum_5', 'Momentum_20',
        'RSI14', 'Return_1', 'Return_2', 'Return_3'
    ]

    model_dt = DecisionTreeRegressor(max_depth=4, min_samples_leaf=10, random_state=42)
    model_rf = RandomForestRegressor(
        n_estimators=40,
        max_depth=5,
        min_samples_leaf=8,
        random_state=42,
        n_jobs=-1,
    )
    model_gb = GradientBoostingRegressor(
        n_estimators=80,
        learning_rate=0.05,
        max_depth=2,
        random_state=42,
    )

    ensemble_preds = []
    pred_confidences = []

    retrain_every = 5
    weights = np.array([0.25, 0.4, 0.35], dtype=float)

    for step_idx, i in enumerate(range(window, len(df))):
        X_test = df.iloc[[i]][features]

        if step_idx % retrain_every == 0:
            X_train, y_train = df.iloc[:i][features], df.iloc[:i]['Target']

            model_dt.fit(X_train, y_train)
            model_rf.fit(X_train, y_train)
            model_gb.fit(X_train, y_train)

            # Weight models by recent inverse MAE so better recent performers influence signal more.
            recent = min(60, len(X_train))
            if recent >= 30:
                X_recent = X_train.iloc[-recent:]
                y_recent = y_train.iloc[-recent:]

                mae_dt = np.mean(np.abs(model_dt.predict(X_recent) - y_recent)) + 1e-9
                mae_rf = np.mean(np.abs(model_rf.predict(X_recent) - y_recent)) + 1e-9
                mae_gb = np.mean(np.abs(model_gb.predict(X_recent) - y_recent)) + 1e-9

                inv = np.array([1 / mae_dt, 1 / mae_rf, 1 / mae_gb], dtype=float)
                weights = inv / inv.sum()

        pred_dt = model_dt.predict(X_test)[0]
        pred_rf = model_rf.predict(X_test)[0]
        pred_gb = model_gb.predict(X_test)[0]

        ensemble_pred = float(weights[0] * pred_dt + weights[1] * pred_rf + weights[2] * pred_gb)
        current_vol = float(df.iloc[i]['Volatility'])
        confidence = abs(ensemble_pred) / (current_vol + 1e-9)

        ensemble_preds.append(ensemble_pred)
        pred_confidences.append(confidence)
        
    result_df = df.iloc[window:].copy()
    result_df['Pred_Ensemble'] = pd.Series(ensemble_preds, index=result_df.index)
    result_df['Pred_Confidence'] = pd.Series(pred_confidences, index=result_df.index)

    # MA Crossover Benchmark
    result_df['Signal_MA'] = np.where(result_df['MA10'] > result_df['MA50'], 1, 0)
    result_df['Return_MA'] = result_df['Signal_MA'] * result_df['Target']
    result_df['Cum_MA'] = (1 + result_df['Return_MA']).cumprod()

    # AI Strategy (ensemble + tuned dynamic position sizing).
    direction_strength = np.tanh(result_df['Pred_Ensemble'] / (result_df['Volatility'] + 1e-9))
    trend_bias = np.where(result_df['MA20'] > result_df['MA50'], 0.32, 0.0)
    confidence_bias = np.where(
        result_df['Pred_Confidence'] > 1.6,
        np.sign(result_df['Pred_Ensemble']) * 0.22,
        0.0,
    )

    result_df['Position_DT'] = np.clip(
        1.0 + 0.55 * direction_strength + trend_bias + confidence_bias,
        0.30,
        2.00,
    )
    result_df['Signal_DT'] = np.where(result_df['Position_DT'] >= 1.0, 1, 0)
    result_df['Return_DT'] = result_df['Position_DT'] * result_df['Target']
    result_df['Cum_DT'] = (1 + result_df['Return_DT']).cumprod()

    # Buy & Hold Benchmark
    result_df['Cum_Hold'] = (1 + result_df['Target']).cumprod()
    
    return result_df

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