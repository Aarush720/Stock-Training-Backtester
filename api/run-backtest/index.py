import json
from http.server import BaseHTTPRequestHandler

from main import compute_risk_metrics, fetch_and_engineer, run_models


class handler(BaseHTTPRequestHandler):
    def _send_json(self, status_code: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self._send_json(200, {"status": "ok"})

    def do_POST(self) -> None:
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            raw_body = self.rfile.read(content_length) if content_length > 0 else b"{}"
            payload = json.loads(raw_body.decode("utf-8"))

            ticker = str(payload.get("ticker", "AAPL")).upper()
            start_date = str(payload.get("start_date", "2020-01-01"))
            end_date = str(payload.get("end_date", "2024-01-01"))
            train_window = int(payload.get("train_window", 200))

            if train_window <= 0:
                raise ValueError("train_window must be greater than 0.")

            # Keep compatibility with frontend's month-based slider values.
            effective_window = train_window * 21 if train_window <= 60 else train_window

            df = fetch_and_engineer(ticker, start_date, end_date)

            if len(df) <= effective_window:
                raise ValueError(
                    f"Not enough data for train_window={train_window}. "
                    "Try a smaller train window or wider date range."
                )

            results = run_models(df, effective_window)

            if results.empty:
                raise ValueError("Backtest produced no results. Try a wider date range.")

            dt_total = (results["Cum_DT"].iloc[-1] - 1) * 100
            hold_total = (results["Cum_Hold"].iloc[-1] - 1) * 100
            ma_total = (results["Cum_MA"].iloc[-1] - 1) * 100
            sharpe_ratio, max_drawdown = compute_risk_metrics(results["Return_DT"])

            starting_capital = 10000
            chart_data = []
            for index, row in results.iterrows():
                chart_data.append(
                    {
                        "date": index.strftime("%Y-%m-%d"),
                        "AI": round(row["Cum_DT"] * starting_capital, 2),
                        "Benchmark": round(row["Cum_Hold"] * starting_capital, 2),
                        "Benchmark_MA": round(row["Cum_MA"] * starting_capital, 2),
                    }
                )

            self._send_json(
                200,
                {
                    "status": "success",
                    "metrics": {
                        "ai_return": round(dt_total, 2),
                        "benchmark_return": round(hold_total, 2),
                        "ma_benchmark_return": round(ma_total, 2),
                        "alpha": round(dt_total - hold_total, 2),
                        "sharpe_ratio": round(sharpe_ratio, 2),
                        "max_drawdown": round(max_drawdown, 2),
                    },
                    "chart_data": chart_data,
                },
            )
        except Exception as exc:
            self._send_json(400, {"status": "error", "detail": str(exc)})