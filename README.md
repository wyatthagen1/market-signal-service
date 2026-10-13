# market-signal-service

Non-weather signal producers for the trading platform. Each producer is a run-once
Railway cron that reads Kalshi public data and the platform database, writes its own
tables, and pushes a store to the trading fleet through the signal router.
