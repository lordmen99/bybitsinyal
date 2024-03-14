import { BollingerBands, EMA, RSI, StochasticRSI } from 'technicalindicators';
import { Hono } from 'hono';

type OHLCV = {
	timestamp: number;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
};
type Interval = '1' | '3' | '5' | '15' | '30' | '60' | '120' | '240' | '360' | '720' | 'D' | 'W' | 'M';
type Trend = 'Up' | 'Down' | 'Unknown';

interface KlineResponse {
	result: {
		list: any[];
	};
}

const getOHLCVs = async (symbol: string, interval: Interval, limit: string): Promise<OHLCV[]> => {
	try {
		const bybitUrl = `https://api.bybit.com/v5/market/kline`;
		const query = new URLSearchParams({ category: 'spot', symbol, interval, limit });
		const res = await fetch(`${bybitUrl}?${query}`);
		const kline: KlineResponse = await res.json();
		const ohlcvs = kline.result.list?.map((candle) => ({
			timestamp: parseFloat(candle[0]),
			open: parseFloat(candle[1]),
			high: parseFloat(candle[2]),
			low: parseFloat(candle[3]),
			close: parseFloat(candle[4]),
			volume: parseFloat(candle[5]),
		}));
		return ohlcvs.reverse();
	} catch (error) {
		console.error(error);
		return [];
	}
};

const getRSIs = (ohlcvs: OHLCV[]) => {
	const closes = ohlcvs.map((candle) => candle.close);
	const rsi14 = RSI.calculate({ period: 14, values: closes });
	const latestRSI14 = rsi14[rsi14.length - 1];
	return { rsi14, latestRSI14 };
};

const getStochRSIs = (ohlcvs: OHLCV[]) => {
	const closes = ohlcvs.map((candle) => candle.close);
	const stochRSI14 = StochasticRSI.calculate({ rsiPeriod: 14, stochasticPeriod: 14, kPeriod: 3, dPeriod: 3, values: closes });
	const latestStochRSI14 = stochRSI14[stochRSI14.length - 1];
	return { stochRSI14, latestStochRSI14 };
};

const getEMAs = (ohlcvs: OHLCV[]) => {
	const closes = ohlcvs.map((candle) => candle.close);
	const ema50 = EMA.calculate({ period: 50, values: closes });
	const ema200 = EMA.calculate({ period: 200, values: closes });
	const latestEMA50 = ema50[ema50.length - 1];
	const latestEMA200 = ema200[ema200.length - 1];
	let trend: Trend = 'Unknown';
	if (latestEMA50 > latestEMA200) trend = 'Up';
	if (latestEMA50 < latestEMA200) trend = 'Down';
	return { ema50, ema200, trend, latestEMA50, latestEMA200 };
};

const getBBs = (ohlcvs: OHLCV[]) => {
	const closes = ohlcvs.map((candle) => candle.close);
	const bb20 = BollingerBands.calculate({ period: 20, values: closes, stdDev: 2 });
	const latestBB20 = bb20[bb20.length - 1];
	return { bb20, latestBB20 };
};

const app = new Hono();

// GET /?symbol=BTCUSDT&interval=120
app.get('/', async (c) => {
	const symbol = c.req.query('symbol') ?? 'BTCUSDT';
	const interval = (c.req.query('interval') as Interval) ?? '60';
	const limit = c.req.query('limit') ?? '250';
	const ohlcv = await getOHLCVs(symbol, interval, limit);
	const { latestRSI14 } = getRSIs(ohlcv);
	const { latestStochRSI14 } = getStochRSIs(ohlcv);
	const { latestEMA50, latestEMA200, trend } = getEMAs(ohlcv);
	const { latestBB20 } = getBBs(ohlcv);
	const latestOHLCV = ohlcv[ohlcv.length - 1];
	const latestCandle = {
		symbol,
		interval,
		dateTime: new Date(latestOHLCV?.timestamp).toLocaleString('en-MS'),
		ohlcv: latestOHLCV,
		rsi14: latestRSI14,
		stochRsi14: latestStochRSI14,
		ema50: latestEMA50,
		ema200: latestEMA200,
		bb20: latestBB20,
		trend,
	};
	return c.json(latestCandle);
});

export default app;
