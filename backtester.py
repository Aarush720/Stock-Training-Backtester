import yfinance as yf
import pandas as pd
import numpy as np
from sklearn.tree import DecisionTreeRegressor
import matplotlib.pyplot as plt
import warnings
warnings.filterwarnings('ignore')

def fetch_data(ticker="AAPL", start_date="2019-01-01", end_date="2024-01-01"):
    print(f"Downloading data for {ticker}...")
    df = yf.download(ticker, start=start_date, end=end_date)
    df = df[['Close']].copy()
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = ['Close']
    return df

def engineer_features(df):
    df['Return'] = df['Close'].pct_change()
    df['MA10'] = df['Close'].rolling(window=10).mean()
    df['MA50'] = df['Close'].rolling(window=50).mean()
    df['MA_diff'] = df['MA10'] - df['MA50']
    df['Volatility'] = df['Return'].rolling(window=10).std()
    df['Return_1'] = df['Return'].shift(1)
    df['Return_2'] = df['Return'].shift(2)
    df['Target'] = df['Return'].shift(-1)
    df.dropna(inplace=True)
    return df

def walk_forward_training(df, train_window=200):
    features = ['Return', 'MA10', 'MA50', 'MA_diff', 'Volatility', 'Return_1', 'Return_2']
    model_dt = DecisionTreeRegressor(max_depth=3 ,random_state=42) 
    
    preds_dt = []
    for i in range(train_window, len(df)):
        X_train, y_train = df.iloc[:i][features], df.iloc[:i]['Target']
        X_test = df.iloc[[i]][features]
        model_dt.fit(X_train, y_train)
        preds_dt.append(model_dt.predict(X_test)[0])
        
    result_df = df.iloc[train_window:].copy()
    result_df['Signal_DT'] = np.where(pd.Series(preds_dt) > 0, 1, 0)
    
    print("\n DECISION TREE FEATURE IMPORTANCES:")
    importances = pd.DataFrame({'Feature': features, 'Importance': model_dt.feature_importances_}).sort_values(by='Importance', ascending=False)
    print("-" * 35)
    for index, row in importances.iterrows():
        print(f"{row['Feature']:<15}: {row['Importance'] * 100:>5.1f}%")
    print("-" * 35)

    return result_df

def evaluate_performance(df):
    # 1. Decision Tree Performance
    df['Return_DT'] = df['Signal_DT'] * df['Target']
    df['Cum_DT'] = (1 + df['Return_DT']).cumprod()
    
    # 2. MA Crossover Benchmark Performance
    df['Signal_MA'] = np.where(df['MA10'] > df['MA50'], 1, 0)
    df['Return_MA'] = df['Signal_MA'] * df['Target']
    df['Cum_MA'] = (1 + df['Return_MA']).cumprod()
    
    # 3. Buy & Hold Performance
    df['Cum_Hold'] = (1 + df['Target']).cumprod()
    
    print(f"Decision Tree Return:  {(df['Cum_DT'].iloc[-1] - 1) * 100:6.2f}%")
    print(f"MA Crossover Return:   {(df['Cum_MA'].iloc[-1] - 1) * 100:6.2f}%")
    print(f"Buy & Hold Return:     {(df['Cum_Hold'].iloc[-1] - 1) * 100:6.2f}%")
    
    return df

if __name__ == "__main__":
    df = engineer_features(fetch_data("AAPL", "2019-01-01", "2024-01-01"))
    results = evaluate_performance(walk_forward_training(df))
    
    plt.figure(figsize=(12, 6))
    plt.plot(results['Cum_Hold'], label='Buy & Hold', color='gray', alpha=0.5, linestyle='--')
    plt.plot(results['Cum_MA'], label='MA Crossover Benchmark', color='orange', alpha=0.7)
    plt.plot(results['Cum_DT'], label='Decision Tree Strategy', color='green', linewidth=2)
    
    plt.title('Strategy Race: Decision Tree vs Benchmarks')
    plt.ylabel('Growth (1 = Starting Capital)')
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.show()